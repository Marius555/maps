"use client";

import {
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { motion } from "motion/react";

import { PRODUCT_NAME } from "@/lib/config";
import {
  BILL_AXIS_MAX,
  BILL_AXIS_MIN,
  BILL_AXIS_TICKS,
  billSeries,
  type BillPoint,
} from "@/lib/marketing/compare";
import {
  MAX_VIEWS,
  MIN_VIEWS,
  VIEW_TICKS,
  viewsLabel,
} from "@/lib/marketing/cost";

import { BillTooltip } from "./bill-tooltip";

const MONEY = new Intl.NumberFormat("en-GB", { maximumFractionDigits: 0 });

const VIEW_TICK_VALUES = VIEW_TICKS.map((tick) => tick.views);

/** How long one line takes to draw, and how far behind the one before it it starts. */
const DRAW_MS = 1100;
const STAGGER_MS = 140;

/** The house curve — the same one `Reveal` and the table's count use. */
const EASE = [0, 0, 0.2, 1] as const;

/** What the chart holds before it is drawn: the axes, and nothing on them. */
const NO_DATA: BillPoint[] = [];

/**
 * The three bills as three lines, from a thousand views a month to a million.
 *
 * **This replaced three small bar charts, and the thing that changed is what is
 * on screen at once.** The bars drew three traffic levels as three separately
 * scaled columns, and the reader had to hold one column in their head to
 * compare it with the next; the shape the section is about — two lines climbing
 * and one that does not — only existed in the gap between the columns. A line
 * chart draws that shape directly.
 *
 * **Both axes are log, and the old version rejected that for a reason worth
 * answering rather than ignoring.** `compareRows`' docblock says a log axis
 * needs a paragraph of explanation before it says anything, and it is right
 * about a bare one. The answer is not to avoid it — a linear bill axis pins a
 * flat €19 against a $7,000 metered bill to the baseline, invisible, which is
 * the exact failure the three separate scales were working around. It is to
 * label it: every tick on both axes prints a real number a reader recognises
 * (1k, 10k, $100, $1,000), and the caption under the chart says in one line
 * that a step on either axis is ten times. The shape then reads without the
 * scale being understood at all — one line is flat and two are not.
 *
 * **The axis domains are imported, not written here.** A log axis silently
 * drops any point outside its domain: no warning, no gap, just a series that
 * stops early. `compare.test.ts` asserts every point of `billSeries` lands
 * inside `BILL_AXIS_MIN`/`MAX`, so that failure is a red test instead.
 *
 * The three colours are `--mk-series-*` in globals.css, measured against each
 * mode's panel with the dataviz validator — see the note there before changing
 * one. Identity never rests on colour alone: the quiet series is dashed, each
 * line is labelled at its own right-hand end, and `BillTable` under the chart
 * carries the same numbers as text.
 *
 * **It draws itself when the section arrives, and that is recharts' own
 * animation.** A `Line` with animation on is drawn by growing its
 * `strokeDasharray` from nothing to the path's length — a line being drawn, not
 * a line fading in — so there is no hand-written animation here. What this file
 * adds is *when*: the chart mounts a screen early so its chunk is loaded
 * (bill-chart-loader.tsx), holds `NO_DATA` until `draw`, and the arrival of
 * the real series is what recharts animates. The axes and grid fade in with it,
 * and each line's name — which recharts itself withholds until that line has
 * finished — fades rather than pops.
 *
 * **The bill axis does not count up, and cannot.** It is logarithmic with a $10
 * floor; there is no zero on it, and ticks counting up from $0 would print values
 * that do not match the gridlines they sit on. The table's figures are what count.
 *
 * Reduced motion: `isAnimationActive` is left at recharts' default of
 * `'auto'`, which is "not during SSR and not under `prefers-reduced-motion`",
 * so the lines are simply there.
 *
 * Loaded through `next/dynamic` with `ssr: false` by bill-chart-loader.tsx —
 * recharts is a client-only tree and this page's rule (see ../reveal.tsx) is
 * that nothing important may arrive blank in the served HTML. The table is what
 * arrives instead.
 */
export function BillChart({
  flat,
  draw,
}: {
  flat: number;
  /** True once the section is on screen — the moment the lines start drawing. */
  draw: boolean;
}) {
  const data = billSeries(flat);
  /* Which sample carries the end-of-line label. Derived, never the literal 60:
     `billSeries` samples the slider's own track, and `SLIDER_STEPS` has been
     re-tuned once already. */
  const last = data.length - 1;

  return (
    /* The height is the loader's, which reserves it from the server render on. */
    <motion.div
      className="h-full w-full"
      initial={{ opacity: 0 }}
      animate={{ opacity: draw ? 1 : 0 }}
      transition={{ duration: 0.25, ease: EASE }}
    >
      <ResponsiveContainer width="100%" height="100%">
        <LineChart
          data={draw ? data : NO_DATA}
          /* Room on the right for the three end-of-line labels. */
          margin={{ top: 8, right: 96, bottom: 4, left: 4 }}
        >
          <CartesianGrid
            horizontal
            vertical={false}
            stroke="var(--border)"
            strokeDasharray="2 4"
          />

          <XAxis
            type="number"
            dataKey="views"
            scale="log"
            domain={[MIN_VIEWS, MAX_VIEWS]}
            ticks={VIEW_TICK_VALUES}
            tickFormatter={viewsLabel}
            tickLine={false}
            axisLine={{ stroke: "var(--border)" }}
            tick={{ fill: "var(--muted)", fontSize: 11 }}
            tickMargin={8}
          />

          <YAxis
            type="number"
            scale="log"
            domain={[BILL_AXIS_MIN, BILL_AXIS_MAX]}
            ticks={[...BILL_AXIS_TICKS]}
            tickFormatter={(value: number) => `$${MONEY.format(value)}`}
            tickLine={false}
            axisLine={false}
            tick={{ fill: "var(--muted)", fontSize: 11 }}
            width={52}
          />

          <Tooltip
            content={<BillTooltip />}
            cursor={{ stroke: "var(--border)", strokeWidth: 1 }}
          />

          <BillLine
            dataKey="metered"
            label="Metered"
            color="var(--mk-series-metered)"
            last={last}
            labelDy={13}
            begin={0}
          />
          <BillLine
            dataKey="locator"
            label="Locator"
            color="var(--mk-series-locator)"
            last={last}
            labelDy={-4}
            begin={STAGGER_MS}
            dashed
          />
          <BillLine
            dataKey="us"
            label={PRODUCT_NAME}
            color="var(--mk-series-us)"
            last={last}
            begin={STAGGER_MS * 2}
            emphasis
          />
        </LineChart>
      </ResponsiveContainer>
    </motion.div>
  );
}

/**
 * One series, with its name written at the end of it.
 *
 * A direct label rather than a legend box alone: three lines that each end in
 * their own name are read without the eye leaving the plot, and it is the
 * secondary encoding that keeps identity off colour. Recharts wants a component
 * here rather than a fragment, so this returns the `<Line>` itself and is
 * spread into the chart as one.
 */
function BillLine({
  dataKey,
  label,
  color,
  last,
  labelDy = 4,
  begin,
  dashed = false,
  emphasis = false,
}: {
  dataKey: "metered" | "locator" | "us";
  label: string;
  color: string;
  /** The index of the final sample — the only point that draws its name. */
  last: number;
  /**
   * How far the name sits off its line's own end.
   *
   * **The metered and locator lines converge, and their labels landed on top of
   * each other** — measured 1px apart, one word printed over the other. That is
   * not a layout accident, it is the data: at a million views a month the
   * locator's $49 subscription is 0.7% of the $7,000 of map loads beside it, so
   * the two bills *are* the same bill. Nudging the names apart states that; a
   * collision-avoidance pass that moved them by however much it took would
   * hide it behind a number nobody chose.
   */
  labelDy?: number;
  /**
   * When this line starts drawing, in ms after the section arrives. Staggered so
   * the eye follows one line at a time and ends on ours, which draws last.
   */
  begin: number;
  dashed?: boolean;
  emphasis?: boolean;
}) {
  return (
    <Line
      type="linear"
      dataKey={dataKey}
      stroke={color}
      strokeWidth={emphasis ? 2.5 : 2}
      strokeDasharray={dashed ? "5 4" : undefined}
      dot={false}
      activeDot={{ r: 4, strokeWidth: 0, fill: color }}
      animationBegin={begin}
      animationDuration={DRAW_MS}
      animationEasing="ease-out"
      /* Recharts types a label renderer's `x`/`y` as `string | number`, because
         the same prop shape serves marks that are positioned in other units.
         On a line's point they are always numbers; `Number()` is the coercion
         that says so without an `as`. */
      label={(props: { index?: number; x?: string | number; y?: string | number }) =>
        props.index === last ? (
          /* A group, not `motion.text`: on an SVG element Motion claims `x`
             and `y` as transforms, and these are the label's position. */
          <motion.g
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.25, ease: EASE }}
          >
            <text
              x={Number(props.x ?? 0) + 8}
              y={Number(props.y ?? 0)}
              dy={labelDy}
              fontSize={11}
              fontWeight={emphasis ? 600 : 400}
              fill={emphasis ? "var(--foreground)" : "var(--muted)"}
            >
              {label}
            </text>
          </motion.g>
        ) : (
          <></>
        )
      }
    />
  );
}
