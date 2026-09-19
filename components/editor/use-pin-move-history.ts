"use client";

import { useCallback, useEffect, useRef, useState } from "react";

import {
  positionOf,
  pushMove,
  retainMoves,
  takeLatest,
  type PinMove,
} from "@/lib/map/pin-move-history";
import { useUpdatePlace } from "@/lib/query/places";
import { toastError } from "@/lib/query/toast-error";
import type { Place } from "@/lib/repositories/types";

type Coords = { lat: number; lng: number };

/**
 * Where Ctrl/Cmd+Z already means something, and it is not "move a pin back".
 *
 * A text field's own undo — the map search, the edit and rename dialogs — and
 * anything inside a dialog at all, because a modal is a different task laid
 * over the map and a pin moving behind it is a change nobody can see happen.
 */
const OWN_UNDO =
  'input, textarea, select, [contenteditable=""], [contenteditable="true"], [role="dialog"], [role="alertdialog"]';

/**
 * Undo for pins dragged on the editor's map: a history, the toolbar's Undo
 * button and Ctrl/Cmd+Z.
 *
 * Lifted out of the editor for the reason `useAddressResolution` was: it is a
 * piece of state, a race and a key binding, and the component that composes the
 * canvas and the panel has enough of its own. The bookkeeping itself has no
 * React in it — lib/map/pin-move-history.ts.
 */
export function usePinMoveHistory({
  mapId,
  readPlaces,
  isAddressPending,
  cancelAddress,
  lookUpAddress,
  isEnabled,
}: {
  mapId: string;
  /** The cache as it is now — see `record` for why not a rendered array. */
  readPlaces: () => Place[];
  /**
   * Whether this location's own address lookup is still in the air. A reader,
   * not the set: see `isPending` in use-address-resolution.ts.
   */
  isAddressPending: (placeId: string) => boolean;
  /** Stop a lookup still in the air from landing — see `undo`. */
  cancelAddress: (placeId: string) => void;
  /** Ask what is at these coordinates and write it to the location. */
  lookUpAddress: (placeId: string, coords: Coords, currentAddress: string) => void;
  /**
   * False while a drawing or route tool is armed. A pin jumping back in the
   * middle of drawing a polygon is not what anyone pressing Ctrl+Z there meant,
   * and those tools take Backspace for their own step back.
   */
  isEnabled: boolean;
}) {
  const updatePlace = useUpdatePlace(mapId);
  const restore = updatePlace.mutate;

  /*
   * A ref, with a count beside it for rendering.
   *
   * Two presses of Ctrl+Z can arrive before React has rendered between them, and
   * each must take a *different* move. A stack held only in state would hand both
   * presses the same top entry — the second undo would silently repeat the first.
   * The count exists so the toolbar's button re-renders when the stack empties.
   */
  const stack = useRef<PinMove[]>([]);
  const [depth, setDepth] = useState(0);

  const replace = useCallback((next: PinMove[]) => {
    if (next === stack.current) return;

    stack.current = next;
    setDepth(next.length);
  }, []);

  /**
   * Remember where a pin was, just before a drag moves it to `to`.
   *
   * Read through the cache rather than from a render, because the base an undo
   * restores has to be the value the drag replaced — and a render can be a write
   * behind it (CLAUDE.md, on the base of an optimistic write).
   *
   * A drag that let go where it started — the same coordinates once rounded —
   * moved nothing, and an undo for it would be a press that visibly does nothing.
   */
  const record = useCallback(
    (placeId: string, to: Coords) => {
      const place = readPlaces().find((candidate) => candidate.id === placeId);
      if (!place || (place.lat === to.lat && place.lng === to.lng)) return;

      replace(
        pushMove(stack.current, {
          placeId,
          before: positionOf(place),
          addressWasPending: isAddressPending(placeId),
        }),
      );
    },
    [readPlaces, isAddressPending, replace],
  );

  /**
   * Put the newest moved pin back where it was.
   *
   * **The address lookup is cancelled first.** The drag started one, and if it
   * answered after the pin was back it would file the restored location under
   * the street it had been dragged to — the exact wrongness the undo is fixing.
   *
   * **One PATCH carrying everything the drag and its lookup changed.** Place
   * PATCHes queue per map (`useUpdatePlace`'s scope), so a move or an address
   * write still in flight lands before this rather than over it.
   */
  const undo = useCallback(() => {
    if (!isEnabled) return;

    const places = readPlaces();
    const { move, rest } = takeLatest(
      stack.current,
      new Set(places.map((place) => place.id)),
    );

    replace(rest);
    if (!move) return;

    const { placeId, before } = move;
    cancelAddress(placeId);

    const onError = (error: unknown) =>
      toastError(error, "Couldn't undo the move");

    if (!move.addressWasPending) {
      restore({ placeId, input: before }, { onError });
      return;
    }

    /*
     * The address stored with this move was never true of these coordinates —
     * the pin's own lookup had not answered when the drag began — so it is not
     * written back. The position is, and the question is asked again.
     */
    restore(
      {
        placeId,
        input: {
          lat: before.lat,
          lng: before.lng,
          geocodeStatus: before.geocodeStatus,
        },
      },
      { onError },
    );

    const current = places.find((place) => place.id === placeId)?.address ?? "";
    lookUpAddress(placeId, { lat: before.lat, lng: before.lng }, current);
  }, [isEnabled, readPlaces, replace, cancelAddress, restore, lookUpAddress]);

  /**
   * Forget the moves of locations that have since been deleted, so the button
   * does not stay lit for a history with nothing left in it to undo.
   */
  const retainOnly = useCallback(
    (placeIds: ReadonlySet<string>) => {
      replace(retainMoves(stack.current, placeIds));
    },
    [replace],
  );

  const canUndo = isEnabled && depth > 0;

  // Bound only while there is something to undo, like the editor's other keys.
  useEffect(() => {
    if (!canUndo) return;

    const onKeyDown = (event: KeyboardEvent) => {
      if (!isUndoKey(event)) return;
      if (event.target instanceof Element && event.target.closest(OWN_UNDO)) {
        return;
      }

      event.preventDefault();
      undo();
    };

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [canUndo, undo]);

  return { canUndo, record, undo, retainOnly };
}

/**
 * Ctrl+Z, or Cmd+Z on a Mac, and nothing else.
 *
 * Not with Shift, which is redo, and not held down: a key repeat would walk
 * back through twenty moves faster than anyone could see which ones went.
 */
function isUndoKey(event: KeyboardEvent): boolean {
  return (
    (event.ctrlKey || event.metaKey) &&
    !event.shiftKey &&
    !event.altKey &&
    !event.repeat &&
    !event.defaultPrevented &&
    event.key.toLowerCase() === "z"
  );
}
