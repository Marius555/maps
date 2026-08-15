import type { Shape } from "@/lib/repositories/types";
import type { UpdateShapeInput } from "@/lib/validation/shape.schema";

/**
 * The columns a PATCH can carry.
 *
 * Intersected with `keyof Shape` so that adding a field to `updateShapeSchema`
 * that has no home on the domain row is a type error here, rather than a write
 * this module silently drops. Same contract as place-cache.ts.
 */
export type PatchableShapeKey = keyof UpdateShapeInput & keyof Shape;

/** The keys a PATCH body actually carried — the only ones it may write back. */
export function patchedShapeKeys(input: UpdateShapeInput): PatchableShapeKey[] {
  return Object.keys(input) as PatchableShapeKey[];
}

/** See place-cache.ts: the two index accesses only correlate through one param. */
function copyField<K extends keyof Shape>(
  target: Shape,
  source: Shape,
  key: K,
): void {
  target[key] = source[key];
}

/**
 * Fold a server row into the cached one, one named field at a time.
 *
 * The reason is sharper here than it is for places. Dragging a circle's radius
 * handle fires a geometry PATCH; renaming it in the sidebar fires a name PATCH;
 * both can be in flight at once, and each reply describes the shape as it was
 * before the other landed. A whole-row replace would let the slower one undo the
 * faster one — a circle that springs back to its old size a second after you
 * resized it. Merging only the keys the request carried makes them commute.
 */
export function mergeShapeFields(
  current: Shape,
  source: Shape,
  keys: readonly (keyof Shape)[],
): Shape {
  const merged: Shape = { ...current, updatedAt: source.updatedAt };

  for (const key of keys) copyField(merged, source, key);

  return merged;
}
