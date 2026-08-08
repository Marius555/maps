import type { AppMap, Place } from "@/lib/repositories/types";

/**
 * Has anything changed since the map was last published?
 *
 * Editing a location does not touch the map row, so the map's own `updatedAt` is
 * not enough on its own — a customer who fixes an address and never presses
 * Publish again would otherwise be told their site is up to date while it still
 * serves the old snapshot.
 *
 * Deletions are invisible to this check: removing a location leaves nothing with
 * a later timestamp. That is a known gap, and the reason the Publish button
 * stays enabled whether or not this returns true.
 */

/**
 * Publishing stamps `publishedAt` from a clock read taken *before* the snapshot
 * is uploaded, then writes the map row afterwards — so the row's `updatedAt` is
 * always a little later than the `publishedAt` it just wrote. Without a grace
 * window every successful publish would immediately report itself as stale.
 *
 * Sized to cover a slow upload rather than a plausible edit: a minute is far
 * longer than the write takes, and far shorter than the gap before someone
 * changes something and wonders why nothing updated.
 */
const PUBLISH_WRITE_GRACE_MS = 60_000;

export function hasUnpublishedChanges(map: AppMap, places: Place[]): boolean {
  if (!map.publishedAt) return false;

  const publishedAt = Date.parse(map.publishedAt);
  if (Number.isNaN(publishedAt)) return false;

  if (isAfter(map.updatedAt, publishedAt + PUBLISH_WRITE_GRACE_MS)) return true;

  // Place writes are unrelated to publishing, so they need no grace window.
  return places.some((place) => isAfter(place.updatedAt, publishedAt));
}

function isAfter(timestamp: string, than: number): boolean {
  const parsed = Date.parse(timestamp);

  // A timestamp we can't read must not be reported as a pending change — that
  // would pin a "needs publishing" badge on forever with no way to clear it.
  return Number.isNaN(parsed) ? false : parsed > than;
}
