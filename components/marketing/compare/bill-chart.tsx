"use client";

import { motion } from "motion/react";
import { useId } from "react";
import {
  Area,
  CartesianGrid,
  ComposedChart,
  Line,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import { PRODUCT_NAME } from "@/lib/config";
import { billSeries, type BillPoint } from "@/lib/marketing/compare";
import {
  MAX_VIEWS,
  MIN_VIEWS,
  VIEW_TICKS,
  viewsLabel,
} from "@/lib/marketing/cost";

import { BillTooltip } from "./bill-tooltip";

const MONEY = new Intl.NumberFormat("en-GB", { maximumFractionDigits: 0 });

const VIEW_TICK_VALUES = VIEW_TICKS.map((tick) => tick.views);

/** Their area rises first; our line draws along the floor after it. */
const AREA_MS = 1200;
const LINE_MS = 1100;
const LINE_BEGIN_MS = 400;

/** The house curve — the same one `Reveal` and the table's count use. */
const EASE = [0, 0, 0.2, 1] as const;

/** What the chart holds before it is drawn: the axes, and nothing on them. */
const NO_DATA: BillPoint[] = [];

/** Headroom over the tallest bill, so its end label sits inside the plot. */
const HEADROOM = 1.12;

/**
 * Everybody else's bill as one area that creeps, then shoots up; ours as a
 * line on the floor that never moves.
 *
 * **This is the third form this section has had, and each one taught
 * something.** Three log/log lines drew the metered and locator bills on top
 * of each other and ours a hand's width under them — correct, and the $7,000
 * against €19 gap read as an inch. Two big bars and a slider fixed the drama
 * and repeated the calculator two screens up exactly (owner, 2026-10-18). This
 * keeps the drama and takes a form nothing else on the page has.
 *
 * **Log traffic, linear money — and that is why it is a hockey stick, and why
 * the hockey stick is honest.** The traffic axis steps by ten, the way the
 * slider above does; the money axis is to scale from $0. A bill that grows by
 * $7 per thousand loads then reads $56, $119, $749, $7,049 at each decade,
 * which on those axes is a curve that lies flat and then leaves the chart.
 * That is the shape of being billed per view. Ours is €19 at every point and
 * sits on the floor, which is also simply true. The caption says the traffic
 * axis steps by ten, in one line.
 *
 * **"Everyone else" is the locator figure**, the dearer of the two usual ways
 * (a subscription plus the map loads its own key is still billed for). The
 * metered platform alone is the same curve less $49 — at this scale the width
 * of the stroke, which is exactly why two lines for them overlapped. The
 * tooltip and the table beside the chart break it out.
 *
 * No money axis: the end labels state both bills at a million views, the
 * tooltip states them anywhere, and the table prints nine of them.
 *
 * It draws on arrival with recharts' own animation (`isAnimationActive` left
 * at `'auto'`, so not during SSR and not under reduced motion); the loader
 * decides when (bill-chart-loader.tsx). Loaded `ssr: false`, so `BillTable` is
 * what a reader without script gets.
 */
export function BillChart({
  flat,
  draw,
}: {
  flat: number;
  /** True once the section is on screen — the moment the chart starts drawing. */
  draw: boolean;
}) {
  const fill = useId();
  const data = billSeries(flat);
  /* Which sample carries the end labels. Derived, never the literal 60. */
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
        <ComposedChart
          data={draw ? data : NO_DATA}
          /* Room on the right for the two end labels. */
          margin={{ top: 12, right: 112, bottom: 4, left: 4 }}
        >
          <defs>
            <linearGradient id={fill} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="var(--mk-series-metered)" stopOpacity={0.38} />
              <stop offset="100%" stopColor="var(--mk-series-metered)" stopOpacity={0.02} />
            </linearGradient>
          </defs>

          <CartesianGrid
            horizontal
            vertical={false}
            stroke="var(--border)"
            strokeDasharray="2 6"
          />

          <XAxis
            type="number"
            dataKey="views"
            scale="log"
            domain={[MIN_VIEWS, MAX_VIEWS]}
            ticks={VIEW_TICK_VALUES}
            tickFormatter={viewsLabel}
            /* Every decade, the end ones included: recharts drops a tick it
               judges crowded, and the one it dropped was "1k". */
            interval={0}
            tickLine={false}
            axisLine={{ stroke: "var(--border)" }}
            tick={{ fill: "var(--muted)", fontSize: 11 }}
            tickMargin={8}
          />

          <YAxis
            hide
            type="number"
            domain={[0, (max: number) => max * HEADROOM]}
          />

          <Tooltip
            content={<BillTooltip />}
            cursor={{ stroke: "var(--border)", strokeWidth: 1 }}
          />

          <Area
            type="monotone"
            dataKey="locator"
            stroke="var(--mk-series-metered)"
            strokeWidth={2}
            fill={`url(#${fill})`}
            dot={false}
            activeDot={{ r: 4, strokeWidth: 0, fill: "var(--mk-series-metered)" }}
            animationDuration={AREA_MS}
            animationEasing="ease-out"
            label={(props: LabelProps) =>
              props.index === last ? (
                <EndLabel
                  x={Number(props.x ?? 0)}
                  y={Number(props.y ?? 0)}
                  amount={`$${MONEY.format(data[last].locator)}`}
                  name="Everyone else"
                  placement="below"
                />
              ) : (
                <></>
              )
            }
          />

          <Line
            type="linear"
            dataKey="us"
            className="mk-series-glow"
            stroke="var(--mk-series-us)"
            strokeWidth={3}
            dot={false}
            activeDot={{ r: 4, strokeWidth: 0, fill: "var(--mk-series-us)" }}
            animationBegin={LINE_BEGIN_MS}
            animationDuration={LINE_MS}
            animationEasing="ease-out"
            label={(props: LabelProps) =>
              props.index === last ? (
                <EndLabel
                  x={Number(props.x ?? 0)}
                  y={Number(props.y ?? 0)}
                  amount={`€${MONEY.format(flat)}`}
                  name={PRODUCT_NAME}
                  placement="above"
                  emphasis
                />
              ) : (
                <></>
              )
            }
          />
        </ComposedChart>
      </ResponsiveContainer>
    </motion.div>
  );
}

/**
 * Recharts types a label renderer's `x`/`y` as `string | number`, because the
 * same prop shape serves marks positioned in other units. On a series' point
 * they are always numbers; `Number()` is the coercion that says so.
 */
type LabelProps = { index?: number; x?: string | number; y?: string | number };

/**
 * A bill's figure and name, written off the end of its series.
 *
 * Theirs hangs *below* its point, because the point is at the top of the plot;
 * ours stands *above* its line, because the line is the floor. A group, not
 * `motion.text`: on an SVG element Motion claims `x` and `y` as transforms, and
 * these are the label's position. Recharts withholds a series' labels until it
 * has finished drawing, so each one fades in as its series lands.
 */
function EndLabel({
  x,
  y,
  amount,
  name,
  placement,
  emphasis = false,
}: {
  x: number;
  y: number;
  amount: string;
  name: string;
  placement: "above" | "below";
  emphasis?: boolean;
}) {
  const left = x + 10;
  const amountY = placement === "below" ? y + 14 : y - 22;
  const nameY = amountY + 15;

  return (
    <motion.g
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.3, ease: EASE }}
    >
      <text
        x={left}
        y={amountY}
        fontSize={22}
        fontWeight={650}
        letterSpacing="-0.02em"
        fill={emphasis ? "var(--mk-series-us)" : "var(--foreground)"}
        className="tabular-nums"
      >
        {amount}
      </text>
      <text
        x={left}
        y={nameY}
        fontSize={11}
        fontWeight={emphasis ? 600 : 400}
        fill={emphasis ? "var(--foreground)" : "var(--muted)"}
      >
        {name} / mo
      </text>
    </motion.g>
  );
}
