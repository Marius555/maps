/**
 * What saving a drafted gallery comes to, decided without making a request.
 *
 * The place form holds photos as a draft until Save (`photo-gallery-field.tsx`),
 * so the save is not one call but three stages against three endpoints, and the
 * whole of the difficulty is in *which* calls and *in what order* — none of which
 * needs a network to answer. Same split as `lib/map/route-stops.ts`: the part
 * decidable on its own is the part worth testing, and `lib/query/photo.ts` is
 * then only the I/O.
 *
 * It earns its keep. The first version of this logic read the current order off
 * "the last response received", which is null when nothing has been sent — so
 * pressing Make cover and saving did nothing at all, silently. That is one
 * assertion here and invisible in a screenshot.
 */

/**
 * One tile in the gallery: either a photo the row already has, or a file picked
 * in this dialog that nothing has uploaded yet.
 *
 * Both carry a `url` the image can draw itself from — a storage URL for the
 * first, an object URL for the second — so the grid renders one list and never
 * asks which kind it is holding except here.
 */
export type PhotoSlot =
  | { kind: "saved"; id: string; url: string }
  | { kind: "new"; key: string; file: File; url: string };

export type PhotoSavePlan = {
  /**
   * Ids to drop, in order, one request each — and **first**.
   *
   * The cap is checked against what the row currently holds, so swapping the
   * eighth photo would be refused as a ninth if the upload went first. They are
   * separate requests because the endpoint takes one id, and they must be issued
   * in series: `removePlacePhoto` reads the row, filters it and writes it back,
   * so two in flight both compute their surviving list from the same starting
   * state and the second write restores the first one's photo.
   */
  removals: string[];
  /**
   * Files to upload, in one request, in this order — the route reads
   * `getAll("photo")`, so four photos are one round trip, and `addPlacePhotos`
   * appends them in the order they arrive.
   */
  uploads: File[];
};

export function planPhotoSave(
  slots: readonly PhotoSlot[],
  savedIds: readonly string[],
): PhotoSavePlan {
  const kept = new Set(
    slots.flatMap((slot) => (slot.kind === "saved" ? [slot.id] : [])),
  );

  return {
    removals: savedIds.filter((id) => !kept.has(id)),
    uploads: slots.flatMap((slot) => (slot.kind === "new" ? [slot.file] : [])),
  };
}

/**
 * The order the row should end up in, once every slot names a stored file.
 *
 * `addedIds` are the ids the upload came back with, in the order the files were
 * sent — so they slot back into the positions the user actually put them in,
 * which is the whole reason a reorder is needed at all: the upload appends, and
 * ignores where the photo was dropped.
 */
export function desiredOrder(
  slots: readonly PhotoSlot[],
  addedIds: readonly string[],
): string[] {
  let next = 0;

  return slots.map((slot) =>
    slot.kind === "saved" ? slot.id : addedIds[next++],
  );
}

/** Whether a reorder would change anything — the only reason to send one. */
export function sameOrder(
  a: readonly string[],
  b: readonly string[],
): boolean {
  return a.length === b.length && a.every((id, index) => id === b[index]);
}
