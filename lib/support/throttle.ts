/** How long an account waits between two bug reports. */
export const BUG_REPORT_INTERVAL_MS = 60_000;

/**
 * Whether a report sent at `lastIso` is too recent to allow another at `now`.
 *
 * An unreadable stamp allows it: the throttle is there to stop a stuck finger or
 * a script, not to lock somebody out over a malformed pref.
 */
export function isTooSoon(lastIso: string | undefined, now: Date): boolean {
  if (!lastIso) return false;

  const last = Date.parse(lastIso);
  if (Number.isNaN(last)) return false;

  return now.getTime() - last < BUG_REPORT_INTERVAL_MS;
}
