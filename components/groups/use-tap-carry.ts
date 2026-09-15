"use client";

import { useEffect } from "react";

import { dropTargetAt } from "./drop-target-at";
import type { DropTarget } from "./row-drag-context";
import type { DraggedObject } from "./use-row-drag";

/**
 * Click-to-place: something picked up by one click and put down by the next.
 *
 * The press-and-move gesture (use-row-drag.ts) was the only way onto the card
 * designer's canvas, and a drag has to be held the whole way — across the
 * screen, out of a sheet, past a scroller. A click is two gestures with a rest
 * between them: pick a block, look at where it can go, pick a place.
 *
 * **It is the same carry, not a second one.** A tap puts its object into the
 * drag context's `dragged`, exactly where a drag does, so everything that
 * answers a drag answers this unchanged — the card's drop areas light, the sheet
 * parks at its peek, the drop lands through the same `onDrop` and the block
 * bounces in. What differs is only how a carry *ends*, and that is this hook.
 *
 * Window listeners, bound only while a tap carry is live:
 *
 * - **`pointermove`** lights the place under the cursor (`overId`), so the bold
 *   mark previews the landing the way the copy in the hand does for a drag. Not
 *   for touch, which has no hover to preview with.
 * - **`click`, in the capture phase.** Over a target that accepts, the carry is
 *   **ended first and then dropped** — `finish()`'s order in use-row-drag.ts,
 *   which `DesignerSidePanel` closes the sheet on — and the click goes no
 *   further, so the workspace's own click (which deselects) never hears it.
 *   Anywhere else the carry ends and the click carries on to whatever it was
 *   for: a tab, Save, the backdrop.
 * - **Escape** ends it, as it abandons every drag here.
 *
 * **Capture, for two reasons.** It runs before anything under the pointer can
 * stop the click reaching the window — a button's press handling, a block's own
 * `stopPropagation` — so every click outside a place really does end the carry.
 * And the click that *started* the carry is past the window's capture phase by
 * the time this listener can exist, however synchronously React flushes the
 * effect, so a carry can never be ended by the click that began it.
 *
 * **A tap source is left to toggle itself** (`TAP_SOURCE_PROPS`). Ending the
 * carry here and then letting the tile's own click decide would be a race:
 * React flushes the first update in a microtask between this listener and its
 * own, so the tile would read "not carried" and pick itself straight back up.
 *
 * Only a place is a drop. A blocked line and the card's own catch-all accept
 * with a handler that does nothing, so a click on either ends the carry and
 * changes nothing — exactly what letting go of a drag there does.
 */
export function useTapCarry({
  carried,
  find,
  setOverId,
  tap,
}: {
  /** What a click is carrying, or null while there is no tap carry. */
  carried: DraggedObject | null;
  find: (id: string) => DropTarget | undefined;
  setOverId: (id: string | null) => void;
  tap: (object: DraggedObject | null) => void;
}): void {
  useEffect(() => {
    if (!carried) return;

    const end = () => {
      setOverId(null);
      tap(null);
    };

    const onPointerMove = (event: PointerEvent) => {
      if (event.pointerType === "touch") return;
      setOverId(dropTargetAt(find, carried, event.clientX, event.clientY));
    };

    const onClick = (event: MouseEvent) => {
      if (
        event.target instanceof Element &&
        event.target.closest("[data-tap-source]")
      ) {
        return;
      }

      // `detail` is 0 for a click raised from the keyboard — Enter on a focused
      // button — whose coordinates are the window's corner rather than anywhere
      // somebody aimed. It ends the carry and lands nothing.
      const id =
        event.detail === 0
          ? null
          : dropTargetAt(find, carried, event.clientX, event.clientY);

      end();
      if (!id) return;

      event.preventDefault();
      event.stopPropagation();
      find(id)?.onDrop(carried);
    };

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") end();
    };

    window.addEventListener("pointermove", onPointerMove);
    window.addEventListener("click", onClick, { capture: true });
    window.addEventListener("keydown", onKeyDown);

    return () => {
      window.removeEventListener("pointermove", onPointerMove);
      window.removeEventListener("click", onClick, { capture: true });
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [carried, find, setOverId, tap]);
}

/**
 * Spread on anything that starts a tap carry and toggles it itself — a palette
 * tile. Clicks inside it are left to it; see the note on `useTapCarry`.
 */
export const TAP_SOURCE_PROPS = { "data-tap-source": true } as const;
