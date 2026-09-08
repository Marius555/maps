import { formatCount } from "@/lib/format/number";
import type { Rate } from "@/lib/analytics/view";

/**
 * One share, with the two numbers it came from.
 *
 * Separate from `StatTile` rather than a mode of it, because the two say
 * genuinely different things: a stat tile is a quantity and how it moved, this
 * is a proportion of a stated whole. Merging them would mean one component whose
 * every line is a conditional.
 *
 * **The denominator is always on screen.** "68%" over nothing stated is the
 * classic dashboard lie — 68% of what, out of how many? Two sessions and a
 * hundred both produce a percentage, and only one of them is worth acting on.
 * Writing "17 of 25 searches" underneath costs a line and makes the figure
 * checkable.
 *
 * Deliberately no delta. These are ratios, and a ratio's change is a third-order
 * number ("the bounce rate rose 4% against the previous period" — 4% of a
 * percentage?) that nobody reads correctly. The tiles above carry the movement.
 */
export function RateTile({
  label,
  rate,
  unit,
  hint,
  tone = "neutral",
}: {
  label: string;
  rate: Rate;
  /** What the denominator counts: "sessions", "searches". */
  unit: string;
  /** What the number means, when the label alone would not say. */
  hint?: string;
  /** `warn` colours a high share, for a rate where high is bad. */
  tone?: "neutral" | "warn";
}) {
  return (
    <div className="rounded-xl border border-border bg-surface px-3.5 py-3">
      <p className="text-xs text-muted">{label}</p>

      <p
        className="mt-0.5 text-2xl font-semibold tabular-nums tracking-tight"
        style={{ color: colourFor(rate, tone) }}
      >
        {rate.share === null ? "—" : `${String(Math.round(rate.share * 100))}%`}
      </p>

      <p className="mt-1 text-xs text-muted">
        {rate.share === null
          ? `No ${unit} yet`
          : `${formatCount(rate.count)} of ${formatCount(rate.of)} ${unit}`}
      </p>

      {hint ? <p className="mt-0.5 text-xs text-muted">{hint}</p> : null}
    </div>
  );
}

/**
 * Colour only where it means something, and never as the only signal.
 *
 * A bounce rate over half is worth noticing, so it warms — but the figure, the
 * denominator and the label all still say it in words, which is what keeps the
 * tile readable in forced-colors mode and for anyone who cannot separate the
 * hues. Below the threshold, and for every neutral rate, this is ordinary ink:
 * a page where every number is coloured is a page where colour means nothing.
 */
function colourFor(rate: Rate, tone: "neutral" | "warn"): string {
  if (tone !== "warn" || rate.share === null || rate.share < 0.5) {
    return "var(--foreground)";
  }

  return "var(--warning-ink)";
}
