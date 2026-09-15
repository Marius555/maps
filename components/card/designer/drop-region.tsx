"use client";

import { motion } from "motion/react";

import {
  dropRegionBreathMotion,
  dropRegionMotion,
} from "@/components/ui/list-row-motion";
import type { DropRegion } from "@/lib/card/drop-bands";

/**
 * One area the block in the air can go into, drawn for the whole gesture — and
 * asking to be aimed at.
 *
 * Deliberately not `SlotMark` with a prop. A region has no settle from 92% and
 * no square,
 * so the shared version would be a component that is mostly branches on which of
 * the two it is, and every one of those branches would be a chance for the quiet
 * layer to start behaving like the loud one.
 *
 * **It used to be the quietest thing on the card, and that was not enough.** A
 * one-pixel dashed edge at under half strength told somebody where a block
 * *could* go and never invited them to put it there, so the areas are heavier
 * now (`.card-drop-region`), pop up as the gesture starts and breathe while it
 * lasts. The bold mark and the copy snapping onto it still say *exactly here*;
 * these say *here is somewhere*, louder.
 *
 * Drawing only. The hit areas are `DropSlot`s on the same layer and none of this
 * moves them: a region is `pointer-events: none`, and the scale on it is a
 * transform, which changes nothing `elementFromPoint` reads.
 *
 * Two elements, one property each: the outer one pops, the inner one breathes.
 */
export function DropRegionOutline({ region }: { region: DropRegion }) {
  return (
    <motion.div
      className="pointer-events-none absolute"
      style={{
        // A column knows its own left edge, everything else spans the card's
        // padding, which is where a block's box starts. The same rule as
        // `SlotMark`.
        ...(region.left === undefined
          ? { left: "var(--card-pad)", right: "var(--card-pad)" }
          : {
              left: `${String(region.left)}px`,
              width: `${String(region.width ?? 0)}px`,
            }),
        top: `${String(region.y)}px`,
        height: `${String(region.height)}px`,
      }}
      {...dropRegionMotion()}
    >
      <motion.div
        className="card-drop-region size-full"
        {...dropRegionBreathMotion()}
      />
    </motion.div>
  );
}
