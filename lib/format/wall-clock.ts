/**
 * Wall-clock date-times — what `FormDateTimeField` holds (`YYYY-MM-DDTHH:mm`,
 * no zone) — to and from ISO, read in the browser's own zone. Client-side only
 * in practice: the server has no zone of the person who typed it.
 */

/** A wall-clock date-time as ISO; "" (or anything unreadable) stays "". */
export function wallClockToIso(local: string): string {
  if (!local) return "";
  const date = new Date(local);

  return Number.isNaN(date.getTime()) ? "" : date.toISOString();
}

/** ISO as a wall-clock date-time in this zone, to the minute; null or junk → "". */
export function isoToWallClock(iso: string | null | undefined): string {
  if (!iso) return "";
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "";

  const pad = (value: number) => String(value).padStart(2, "0");

  return `${String(date.getFullYear())}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}
