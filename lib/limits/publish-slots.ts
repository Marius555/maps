/**
 * Which of an account's maps may still publish when it holds more than its plan
 * allows — only possible after a downgrade, or with maps made while
 * `DISABLE_ALL_PLAN` was on.
 *
 * **Live maps take the slots first**, oldest of them first, and unpublished maps
 * fill what is left by creation date. Republishing a live map overwrites the
 * snapshot its owner's site already reads, so refusing it would freeze a map on
 * a customer's page while a never-published draft held the slot. It used to be
 * the oldest maps by creation alone, and that refused exactly this: an older
 * draft outranking the newer map that was live.
 *
 * It does not reopen the downgrade: a Pro account with fifteen live maps on Free
 * still republishes one of them.
 *
 * Pure, so Publish (`holdsPublishSlot`) and the admin console's "would Publish
 * refuse this map" column rank with the same function and cannot disagree.
 */

export type PublishSlotCandidate = {
  id: string;
  publishedAt: string | null;
};

/**
 * The ids of the maps that hold a slot. `maps` must already be ordered oldest
 * first (`$createdAt`, then `$id`) — that order breaks ties within each half.
 */
export function publishingMapIds(
  maps: readonly PublishSlotCandidate[],
  count: number,
): string[] {
  const live = maps.filter((map) => map.publishedAt);
  const drafts = maps.filter((map) => !map.publishedAt);

  return [...live, ...drafts].slice(0, Math.max(0, count)).map((map) => map.id);
}
