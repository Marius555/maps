/**
 * The landing page's cost calculator: what a month of map views costs on a
 * metered platform, against a flat plan.
 *
 * **$7 per 1,000 loads is the figure CLAUDE.md §2 is built on** — the typical
 * list price for a dynamic map load on a metered platform. It is stated on the
 * page as that, with the free allowance those platforms give left out and said
 * to be left out. Below the crossover the metered bill really is the smaller one,
 * and the calculator shows it rather than hiding it.
 *
 * Pure, so the numbers the page prints are the numbers a test checked.
 */

export const METERED_USD_PER_1000 = 7;

const VIEWS = new Intl.NumberFormat("en-GB");

export const MIN_VIEWS = 1_000;
export const MAX_VIEWS = 1_000_000;
export const DEFAULT_VIEWS = 50_000;

/**
 * The slider's resolution: twenty stops a decade. It moves over positions, not
 * views — views span three orders of magnitude, and a linear slider would spend
 * nine-tenths of its track on traffic above 100,000 and leave a small brand's
 * real numbers in the first few pixels.
 *
 * Coarse on purpose. Each stop is about 12% more traffic, so an arrow key always
 * changes the number on screen; at a thousand stops most presses rounded to the
 * value already showing and the control seemed not to respond.
 */
export const SLIDER_STEPS = 60;

/**
 * The decades of the traffic range, with the label each one is written as.
 *
 * **Written out, not formatted, and that is a bug fix rather than a
 * preference.** These used to be `Intl.NumberFormat(notation: "compact")` at
 * each call site, and ICU does not agree with itself across our two runtimes:
 * Node renders `1K / 10K / 100K / 1M` and Chrome renders `1k / 10k / 100k /
 * 1m`. Measured on one screen, the server-rendered comparison table said "1M"
 * in a column beside a client-rendered axis that said "1m" — which is not only
 * inconsistent, it is *milli*, the opposite of a million. Any client component
 * formatting one of these would also hydrate-mismatch.
 *
 * One list, so the slider's tick labels, the survey chart's axis and that
 * table's column headings are the same four strings by construction. Positions
 * are not stored: a tick's place on the slider is `positionOf(views)`, which
 * keeps the labels and the scale from drifting apart.
 */
export const VIEW_TICKS: readonly { views: number; label: string }[] = [
  { views: 1_000, label: "1k" },
  { views: 10_000, label: "10k" },
  { views: 100_000, label: "100k" },
  { views: 1_000_000, label: "1M" },
];

/** A traffic figure as this page writes it, or the plain number if it is not a decade. */
export function viewsLabel(views: number): string {
  return VIEW_TICKS.find((tick) => tick.views === views)?.label ?? VIEWS.format(views);
}

const DECADES = Math.log10(MAX_VIEWS / MIN_VIEWS);

/**
 * A slider position (0 to `SLIDER_STEPS`) as views a month, on a log scale and
 * rounded to two significant figures — "52,000", never "52,480", because a
 * precise-looking number would imply a precision the estimate does not have.
 */
export function viewsAt(position: number): number {
  const share = Math.min(Math.max(position / SLIDER_STEPS, 0), 1);

  return roundToTwoFigures(MIN_VIEWS * 10 ** (share * DECADES));
}

/** The inverse, to the nearest step: where the slider sits for `views`. */
export function positionOf(views: number): number {
  const clamped = Math.min(Math.max(views, MIN_VIEWS), MAX_VIEWS);

  return Math.round((Math.log10(clamped / MIN_VIEWS) / DECADES) * SLIDER_STEPS);
}

/** A month of `views` on a metered platform, before any free allowance. */
export function meteredMonthly(views: number): number {
  return (views / 1000) * METERED_USD_PER_1000;
}

/** The traffic at which a metered bill reaches `flat` — below it, metered is cheaper. */
export function crossoverViews(flat: number): number {
  return roundToTwoFigures((flat / METERED_USD_PER_1000) * 1000);
}

/** Which of the three things the calculator can conclude at a given traffic. */
export type VerdictBranch = "cheaper" | "level" | "multiple";

export type Verdict = { branch: VerdictBranch; text: string };

/**
 * The calculator's one-sentence conclusion at `views`, against a flat `flat`.
 *
 * Below the crossover it says the metered bill is the smaller one, because it
 * is — the chart is showing, not arguing.
 *
 * **The branch comes out with the sentence**, so the page can reserve the room
 * the tallest of the three needs — see `verdictSizers`. `costVerdict` is the
 * same thing as a plain string, which is what most callers want.
 */
export function verdictOf(views: number, flat: number): Verdict {
  const metered = meteredMonthly(views);
  const traffic = `${VIEWS.format(views)} views a month`;

  if (metered < flat) {
    return {
      branch: "cheaper",
      text: `At ${traffic} a metered map is the cheaper one — until about ${VIEWS.format(crossoverViews(flat))} views.`,
    };
  }

  const ratio = metered / flat;
  if (ratio < 1.5) {
    return {
      branch: "level",
      text: `At ${traffic} the two cost about the same — and from here only one of them grows.`,
    };
  }

  const times = ratio < 10 ? ratio.toFixed(1).replace(/\.0$/, "") : String(Math.round(ratio));

  return {
    branch: "multiple",
    text: `At ${traffic}, a metered map costs about ${times}× more.`,
  };
}

/** The same conclusion as the string the page prints. */
export function costVerdict(views: number, flat: number): string {
  return verdictOf(views, flat).text;
}

/**
 * The longest sentence each branch of `verdictOf` can produce — what the page
 * reserves its room for.
 *
 * **This is a layout fix rather than a formatting one.** The verdict sits under
 * two cards in a section that holds a screen and centres what is in it, so a
 * sentence that wraps to two lines at some slider positions and one at others
 * moves everything above it by half a line while the reader is still dragging.
 * Measured at 1442 and at 1024 wide: the sentence went 24px to 48px and both
 * cards moved 12px up. Rendering these invisibly beside the live one
 * (components/marketing/reserve.tsx) makes the block as tall as the tallest
 * thing it can hold, once and at every width.
 *
 * Sampled over `0..SLIDER_STEPS` — the slider's own track, the same rule
 * `billSeries` follows — so a change to the range or to the copy is picked up
 * instead of needing a second list kept in step. Longest *per branch*, because
 * which branch wraps first depends on how wide the page is and the wrapping is
 * the browser's to decide.
 */
export function verdictSizers(flat: number): string[] {
  const longest = new Map<VerdictBranch, string>();

  for (let position = 0; position <= SLIDER_STEPS; position += 1) {
    const { branch, text } = verdictOf(viewsAt(position), flat);
    const held = longest.get(branch);

    if (held === undefined || text.length > held.length) longest.set(branch, text);
  }

  return [...longest.values()];
}

function roundToTwoFigures(value: number): number {
  if (value <= 0) return 0;

  const unit = 10 ** (Math.floor(Math.log10(value)) - 1);

  return Math.round(value / unit) * unit;
}
