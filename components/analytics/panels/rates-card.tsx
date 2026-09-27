import { Meter } from "@heroui/react";

import { formatCount } from "@/lib/format/number";
import type { AnalyticsView, Rate } from "@/lib/analytics/view";
import { METRIC_COLOR } from "../charts/chart-colors";
import { SectionCard } from "../dashboard/section-card";
import { formatShare } from "../format";

type RateEntry = {
  key: string;
  label: string;
  hint: string;
  rate: Rate;
  unit: string;
  /** The metric the share is of, for its bar: `METRIC_COLOR`. */
  color: string;
  /** High is bad — a bounce rate over half warms to warning. */
  warnAbove?: number;
};

/**
 * Whether the map is doing its job, as three shares.
 *
 * Each is a percentage, a bar, and **the two numbers it came from** — "68%"
 * over nothing stated is the classic dashboard lie, and "17 of 25 searches"
 * costs one line and makes it checkable. No trend on these: a ratio's change is
 * a third-order number nobody reads correctly, and the headline row carries
 * the movement.
 *
 * A share with nothing to divide by is left out rather than drawn as 0%, and
 * the card itself is not drawn when all three are — see `ratesOf`.
 */
export function RatesCard({ view }: { view: AnalyticsView }) {
  const entries = ratesOf(view);

  return (
    <SectionCard
      title="How it's working"
      hint="Whether the map did its job, not how much it was used"
    >
      <ul className="space-y-5">
        {entries.map((entry) => {
          const share = entry.rate.share ?? 0;
          const warn = entry.warnAbove !== undefined && share > entry.warnAbove;

          return (
            <li key={entry.key}>
              <div className="flex items-baseline justify-between gap-3">
                <p className="text-sm font-medium text-foreground">{entry.label}</p>
                <p
                  className={`text-lg font-semibold tracking-tight ${
                    warn ? "text-warning-ink" : "text-foreground"
                  }`}
                >
                  {formatShare(share)}
                </p>
              </div>

              <Meter
                aria-label={entry.label}
                value={share * 100}
                valueLabel={formatShare(share)}
                color={warn ? "warning" : "accent"}
                size="sm"
                className="mt-1.5"
              >
                <Meter.Track>
                  {/* The metric's hue, over the named colour HeroUI takes;
                      a warning keeps HeroUI's own warning fill. */}
                  <Meter.Fill style={warn ? undefined : { background: entry.color }} />
                </Meter.Track>
              </Meter>

              <p className="mt-1.5 text-xs text-muted">
                {formatCount(entry.rate.count)} of {formatCount(entry.rate.of)}{" "}
                {entry.unit} · {entry.hint}
              </p>
            </li>
          );
        })}
      </ul>
    </SectionCard>
  );
}

/** The shares worth drawing — every one with a denominator. */
export function ratesOf(view: AnalyticsView): RateEntry[] {
  const all: RateEntry[] = [
    {
      key: "bounce",
      label: "Loaded and left",
      hint: "nothing clicked, searched or opened",
      rate: view.bounce,
      unit: "visits",
      color: METRIC_COLOR.sessions,
      warnAbove: 0.5,
    },
    {
      key: "search",
      label: "Searches that led somewhere",
      hint: "opened a location after searching",
      rate: view.searchConversion,
      unit: "visits that searched",
      color: METRIC_COLOR.searches,
    },
    {
      key: "returning",
      label: "Came back",
      hint: "had visited earlier the same month",
      rate: view.returning,
      unit: "visitors",
      color: METRIC_COLOR.visitors,
    },
  ];

  return all.filter((entry) => entry.rate.share !== null);
}
