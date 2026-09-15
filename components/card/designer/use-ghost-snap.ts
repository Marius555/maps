"use client";

import { useIsPresent } from "motion/react";
import { useLayoutEffect, type RefObject } from "react";

import { useRowDragState } from "@/components/groups/row-drag-context";
import { toCardDrag, type DropBand } from "@/lib/card/drop-bands";
import type { CardDropGeometry } from "./use-drop-bands";

/**
 * Pulls the copy in the hand onto whichever place on the card the pointer is
 * aiming at — the magnet (components/groups/ghost-magnet.ts).
 *
 * **It answers where to draw, never where to drop.** The drag still resolves its
 * target from the pointer, and the slots this answers for are the very ones the
 * pointer found, looked up by the id the drag context already holds. Only a
 * *slot* pulls: a blocked face, the remove wall and the card's own catch-all
 * are not in `bands`, so over any of them the copy lets go and follows the hand
 * — which is also how "you cannot put it there" reads.
 *
 * Registered in a layout effect, in the commit that draws the layer, so the
 * first pointer sample over the card already has an answer. And unregistered
 * the moment `AnimatePresence` starts removing the layer: it keeps its last
 * props for the length of the fade, and a resolver still answering for a
 * gesture that is over would pull the *next* drag onto the last one's slots.
 *
 * The box is converted to viewport px on every call rather than once, from the
 * card's live rect, because the workspace can scroll under a drag. Measured
 * against the card element rather than the layer, because every band's numbers
 * are relative to the card's own box (`measureCard` in use-drop-bands.ts).
 */
export function useGhostSnap(
  layerRef: RefObject<HTMLElement | null>,
  geometry: CardDropGeometry,
  /** `slotId` — passed in rather than imported, because it lives in the layer. */
  idOf: (band: DropBand) => string,
): void {
  const { dragged, registerSnap } = useRowDragState();
  const isPresent = useIsPresent();

  useLayoutEffect(() => {
    const card = layerRef.current?.parentElement;
    if (!isPresent || !card || !dragged) return;

    const { bands, line } = geometry;
    const byId = new Map(bands.map((band) => [idOf(band), band]));

    /*
     * How the copy is seated. A block moved on the card is cloned, so its copy
     * *is* the block about to land and is fitted as one. A palette tile is only
     * a pill standing in for one — seated in a spot the size of a photo it was a
     * small label lost in a large box — so the overlay draws the real block in
     * the spot instead (`DropBlockPreview`) and the pill steps aside. See
     * `SnapBox.fit`.
     */
    const fit = toCardDrag(dragged)?.kind === "move" ? "block" : "preview";

    return registerSnap((id) => {
      const band = byId.get(id);
      if (!band) return null;

      const rect = card.getBoundingClientRect();

      return {
        left: rect.left + (band.left ?? line.left),
        top: rect.top + band.y,
        width: band.width ?? line.width,
        height: Math.max(0, band.height),
        fit,
      };
    });
  }, [layerRef, geometry, idOf, dragged, isPresent, registerSnap]);
}
