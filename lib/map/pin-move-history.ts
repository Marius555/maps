import type { Place } from "@/lib/repositories/types";

/**
 * Undo for pins dragged on the editor's map — the bookkeeping, with no React.
 *
 * A drag is a save (map-editor.tsx `movePlace`), and it is really two writes: the
 * coordinates at once, then the address the reverse geocoder finds there a second
 * later. Undoing it means putting back **everything both writes touched**, which
 * is what `PinPosition` is. Restoring the coordinates alone would leave the pin
 * back where it was and still filed under the street it was dragged to.
 *
 * Kept for as long as the editor is open and not a moment longer. A history in
 * the database would be a table of every drag anyone ever made, to serve a key
 * press that is only ever wanted seconds after the mistake.
 */

/** Everything a drag and the address lookup behind it can change on a row. */
export type PinPosition = Pick<
  Place,
  "lat" | "lng" | "address" | "addressParts" | "geocodeConfidence" | "geocodeStatus"
>;

export type PinMove = {
  placeId: string;
  /** The row as it was before the drag — what undo writes back. */
  before: PinPosition;
  /**
   * The row's own address lookup had not answered when this drag began.
   *
   * Then `before.address` describes somewhere the pin was *before that*, not the
   * position being restored — a pin dropped and dragged straight away still
   * carries the placeholder's empty address. Undo asks again instead of writing
   * back an address that was never true of these coordinates.
   */
  addressWasPending: boolean;
};

/** How many moves back undo can go. */
export const PIN_MOVE_HISTORY_LIMIT = 20;

export function positionOf(place: Place): PinPosition {
  return {
    lat: place.lat,
    lng: place.lng,
    address: place.address,
    addressParts: place.addressParts,
    geocodeConfidence: place.geocodeConfidence,
    geocodeStatus: place.geocodeStatus,
  };
}

/** The history with this move on top, the oldest dropped past the limit. */
export function pushMove(
  stack: readonly PinMove[],
  move: PinMove,
  limit = PIN_MOVE_HISTORY_LIMIT,
): PinMove[] {
  const next = [...stack, move];
  return next.length > limit ? next.slice(next.length - limit) : next;
}

/**
 * The newest move whose location still exists, and the history under it.
 *
 * A deleted location's moves are discarded on the way past rather than undone:
 * there is no pin left to put back, and a key press that silently did nothing
 * would read as undo being broken.
 */
export function takeLatest(
  stack: readonly PinMove[],
  liveIds: ReadonlySet<string>,
): { move: PinMove | null; rest: PinMove[] } {
  for (let index = stack.length - 1; index >= 0; index--) {
    const move = stack[index];
    if (liveIds.has(move.placeId)) {
      return { move, rest: stack.slice(0, index) };
    }
  }

  return { move: null, rest: [] };
}

/**
 * The history without moves of locations that no longer exist.
 *
 * The same array back when nothing was dropped, so a caller holding it in state
 * cannot loop a render — the rule `retain()` in use-address-resolution.ts follows.
 */
export function retainMoves(
  stack: PinMove[],
  liveIds: ReadonlySet<string>,
): PinMove[] {
  const next = stack.filter((move) => liveIds.has(move.placeId));
  return next.length === stack.length ? stack : next;
}
