/**
 * A plain date for a person to read: "21 October 2026".
 *
 * `en-GB`, explicit parts and UTC rather than a locale default, because a date
 * that renders one way on the server and another in the browser is a hydration
 * mismatch — the same trap CLAUDE.md records for `Intl.NumberFormat`'s compact
 * notation, and the reason `number.ts` beside this pins its locale. Day-month-year
 * with the month spelled out cannot be misread as month-day either way round.
 *
 * An unreadable value is returned as it came, rather than as "Invalid Date".
 */
const FORMAT = new Intl.DateTimeFormat("en-GB", {
  day: "numeric",
  month: "long",
  year: "numeric",
  timeZone: "UTC",
});

export function formatDate(iso: string): string {
  const parsed = new Date(iso);

  if (Number.isNaN(parsed.getTime())) return iso;

  return FORMAT.format(parsed);
}
