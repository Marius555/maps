"use client";

import {
  DAY_LABELS_SHORT,
  dayIndex,
  formatDay,
  isEmptyHours,
  isOpenNow,
  type OpeningHours,
} from "@/packages/shared/hours";

/**
 * The week, with today called out.
 *
 * The same shape the embed's popup renders (embed/src/popup.ts), from the same
 * formatters, so what the owner sees here is what a visitor sees there.
 *
 * "Open now" is computed at render. It can go stale if the card is left open
 * across a closing time, which is not worth a ticking interval — the card is a
 * glance, not a dashboard.
 */
export function PlaceCardHours({ hours }: { hours: OpeningHours | null }) {
  if (isEmptyHours(hours) || !hours) return null;

  const today = dayIndex();
  const open = isOpenNow(hours);

  return (
    <div className="space-y-1">
      <p className="flex items-baseline gap-1.5 text-xs">
        <span
          className={`font-medium ${open ? "text-success" : "text-muted"}`}
          // The state is also spelled out in words, so colour is not carrying it
          // alone for a colourblind reader.
        >
          {open ? "Open now" : "Closed now"}
        </span>
        <span className="text-muted">{formatDay(hours[today])}</span>
      </p>

      <dl className="grid grid-cols-[auto_1fr] gap-x-3 text-xs text-muted">
        {hours.map((day, index) => (
          <div key={DAY_LABELS_SHORT[index]} className="contents">
            <dt className={index === today ? "font-medium text-foreground" : ""}>
              {DAY_LABELS_SHORT[index]}
            </dt>
            <dd
              className={`text-right tabular-nums ${
                index === today ? "font-medium text-foreground" : ""
              }`}
            >
              {formatDay(day)}
            </dd>
          </div>
        ))}
      </dl>
    </div>
  );
}
