"use client";

import { useId, useState } from "react";

import { formatCount } from "@/lib/format/number";

/**
 * Sessions per day, as columns.
 *
 * **Hand-drawn, and that is a stack decision rather than a preference.** No
 * charting library is installed and CLAUDE.md §3 says to ask before adding one —
 * and one series of thirty numbers does not justify a dependency the dashboard
 * would carry forever.
 *
 * Flex-boxed divs rather than an SVG, which is the unusual half. An SVG needs a
 * viewBox, and a viewBox needs a width — so a fluid one needs a ResizeObserver
 * and a re-render per resize, for a chart whose only geometry is "how tall is
 * each column". Percentage heights inside a flex row are fluid for free, in CSS,
 * with no measurement at all. Text is the case where SVG would earn it, and
 * there is exactly one label here.
 *
 * What a hand-drawn chart still owes is getting the marks right:
 *
 * - One series, so **no legend**. The heading above says what is plotted; a box
 *   with a single swatch would restate it.
 * - **One value labelled**, the busiest day. A number over every column is the
 *   thing that makes a chart unreadable; the axis and the hover carry the rest.
 * - Columns capped at 24px with a 4px rounded cap and a square foot, separated by
 *   a 2px gap in the surface colour rather than by a stroke.
 * - The grid is one hairline at the top of the scale, in the border token. It
 *   exists to say where the ceiling is, not to be looked at.
 *
 * Colour comes from the app's own accent token, so it follows the theme in both
 * directions — this is a magnitude encoding in one hue, which is what a single
 * series should be. Nothing here is colour-coded by identity, so there is no
 * categorical palette to get wrong.
 *
 * Hover is a plain `title` plus a dimming of the other columns: the tooltip is
 * the browser's, so it survives touch and forced-colors mode with no floating div
 * to position. Every value is also in a visually hidden table underneath, which
 * is the accessible reading and not an afterthought — thirty labelled columns
 * would be thirty stops that each say nothing.
 *
 * The dim is not the only channel: the hovered column keeps its own tooltip, and
 * a reader who cannot perceive the opacity change loses nothing but emphasis.
 * Under `prefers-reduced-motion` the transition is cut to a single pass by the
 * global rule, and the dim still lands — a state told only in motion is told to
 * nobody.
 */

export type DailyPoint = {
  day: string;
  sessions: number;
};

/** Enough height to read a shape, short enough not to dominate the page. */
const HEIGHT = 140;
const MAX_COLUMN = 24;
const GAP = 2;
const CAP_RADIUS = 4;

export function DailyChart({ data }: { data: DailyPoint[] }) {
  const captionId = useId();
  const [hovered, setHovered] = useState<string | null>(null);

  if (data.length === 0) return null;

  const peak = data.reduce(
    (most, point) => (point.sessions > most.sessions ? point : most),
    data[0],
  );

  // A flat zero would divide by nothing; a scale of 1 draws an empty floor.
  const ceiling = Math.max(peak.sessions, 1);

  /*
   * The band each column owns, in percent of the width, so the whole thing is
   * fluid without a ResizeObserver. The column is the band minus the gap, capped
   * — a seven-day range must not draw seven fat slabs.
   */
  const band = 100 / data.length;

  return (
    <figure className="m-0">
      <div
        className="relative"
        style={{ height: HEIGHT }}
        role="img"
        aria-labelledby={captionId}
      >
        {/* The ceiling, and the only gridline. Solid hairline, recessive. */}
        <div
          aria-hidden="true"
          className="absolute inset-x-0 top-0 border-t border-border"
        />

        <div className="absolute inset-0 flex items-end">
          {data.map((point) => {
            const share = point.sessions / ceiling;

            return (
              <div
                key={point.day}
                className="flex h-full items-end justify-center"
                style={{ width: `${band}%`, paddingInline: GAP / 2 }}
                onPointerEnter={() => {
                  setHovered(point.day);
                }}
                onPointerLeave={() => {
                  setHovered(null);
                }}
              >
                <div
                  title={`${formatDay(point.day)}: ${formatCount(point.sessions)} ${
                    point.sessions === 1 ? "visit" : "visits"
                  }`}
                  className="w-full transition-opacity"
                  style={{
                    maxWidth: MAX_COLUMN,
                    /*
                     * A day with nothing still draws a 2px foot rather than
                     * nothing at all: an empty column reads as "no data", a
                     * flat one reads as "nobody came", and those are different
                     * things to tell somebody about their map.
                     */
                    height: `${Math.max(share * 100, point.sessions > 0 ? 3 : 1.5)}%`,
                    borderRadius: `${CAP_RADIUS}px ${CAP_RADIUS}px 0 0`,
                    background:
                      point.sessions > 0 ? "var(--accent)" : "var(--default)",
                    opacity: hovered && hovered !== point.day ? 0.45 : 1,
                  }}
                />
              </div>
            );
          })}
        </div>

        {/* The one direct label: the busiest day, at the cap. */}
        {peak.sessions > 0 ? (
          <span
            aria-hidden="true"
            className="absolute top-0 right-0 -translate-y-1/2 bg-surface pl-1 text-xs tabular-nums text-muted"
          >
            {formatCount(peak.sessions)}
          </span>
        ) : null}
      </div>

      <div className="mt-1.5 flex justify-between text-xs text-muted">
        <span>{formatDay(data[0].day)}</span>
        <span>{formatDay(data[data.length - 1].day)}</span>
      </div>

      {/*
        The accessible reading. A screen reader gets a real table of dates and
        counts; thirty labelled columns would be thirty stops that say nothing
        individually.
      */}
      <figcaption className="sr-only">
        {/*
          The chart's accessible name is this sentence and **only** this
          sentence. Pointing `aria-labelledby` at the whole figcaption read the
          table out as part of the name — "…busiest day 2 Sep with 12. Visits
          per day. Day. Visits. 9 Aug. 2…" — which is the table announced twice,
          once as a label and once as itself.
        */}
        <p id={captionId}>
          {`Visits per day, ${formatDay(data[0].day)} to ${formatDay(
            data[data.length - 1].day,
          )}. Busiest day ${formatDay(peak.day)} with ${formatCount(
            peak.sessions,
          )}.`}
        </p>
        <table>
          <caption>Visits per day</caption>
          <thead>
            <tr>
              <th scope="col">Day</th>
              <th scope="col">Visits</th>
            </tr>
          </thead>
          <tbody>
            {data.map((point) => (
              <tr key={point.day}>
                <th scope="row">{formatDay(point.day)}</th>
                <td>{formatCount(point.sessions)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </figcaption>
    </figure>
  );
}

/**
 * `2026-09-07` → `7 Sep`.
 *
 * Built by hand from the parts rather than through `toLocaleDateString`, for the
 * reason `formatCount` pins its locale: this renders on the server and hydrates
 * in the browser, and a date formatted by two different runtimes' idea of the
 * locale is a hydration error that only appears on somebody else's machine.
 */
const MONTHS = [
  "Jan",
  "Feb",
  "Mar",
  "Apr",
  "May",
  "Jun",
  "Jul",
  "Aug",
  "Sep",
  "Oct",
  "Nov",
  "Dec",
];

export function formatDay(day: string): string {
  const [, month, date] = day.split("-");
  const index = Number(month) - 1;

  if (!date || index < 0 || index > 11) return day;

  return `${String(Number(date))} ${MONTHS[index]}`;
}
