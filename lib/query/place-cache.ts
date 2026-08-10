import type { Place } from "@/lib/repositories/types";
import type { UpdatePlaceInput } from "@/lib/validation/place.schema";

/**
 * The columns a PATCH can carry.
 *
 * Intersected with `keyof Place` so that adding a field to `updatePlaceSchema`
 * that has no home on the domain row is a type error here, rather than a write
 * this module silently drops.
 */
export type PatchableKey = keyof UpdatePlaceInput & keyof Place;

/**
 * The fields the photo endpoints own.
 *
 * Listed by hand because they are not patchable — a photo is uploaded, not sent
 * as JSON — so there is no schema to derive them from.
 */
export const PHOTO_KEYS = [
  "photoId",
  "photoUrl",
] as const satisfies readonly (keyof Place)[];

/** The keys a PATCH body actually carried — the only ones it may write back. */
export function patchedKeys(input: UpdatePlaceInput): PatchableKey[] {
  return Object.keys(input) as PatchableKey[];
}

/**
 * Copy one field between two rows of the same shape.
 *
 * A generic function rather than an inline assignment because
 * `target[key] = source[key]` does not type-check when `key` is a plain union:
 * TypeScript only correlates the two index accesses when they share one type
 * parameter.
 */
function copyField<K extends keyof Place>(
  target: Place,
  source: Place,
  key: K,
): void {
  target[key] = source[key];
}

/**
 * Fold a server row into the cached one, one named field at a time.
 *
 * Replacing the whole row was wrong, and the bug it caused was ugly. Dragging a
 * pin fires two writes about a second apart — the coordinates immediately, the
 * reverse-geocoded address once the lookup answers — and each reply describes the
 * row as it was *before* the other one landed. Whichever answered last therefore
 * reverted the other's field: the pin snapped back to where it had been dragged
 * from, or the street it had just been given turned back into "Location 9". Only
 * sometimes, because it depended on which request won.
 *
 * Taking only the keys the request carried makes the two writes commute, so the
 * order they arrive in stops mattering. `updatedAt` comes along regardless — it
 * is true of the row whichever field changed.
 */
export function mergePlaceFields(
  current: Place,
  source: Place,
  keys: readonly (keyof Place)[],
): Place {
  const merged: Place = { ...current, updatedAt: source.updatedAt };

  for (const key of keys) copyField(merged, source, key);

  return merged;
}
