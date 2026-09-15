"use client";

import { motion } from "motion/react";

import {
  dropSpotBreathMotion,
  dropSpotMotion,
} from "@/components/ui/list-row-motion";
import type { DropBand } from "@/lib/card/drop-bands";
import type { CardDropGeometry } from "./use-drop-bands";

/**
 * One place the block in the air can land, outlined at the size it will land
 * as — for the whole gesture, and asking to be aimed at.
 *
 * **The size of the block, not of the space.** This used to outline each run of
 * free space (`dropRegions`, deleted): one dashed box per empty area, whatever
 * was in the hand. A 62px logo over a 300px gap was shown a 300px box, a dashed
 * box sat where no block would ever land, and the straddling spot under a photo
 * drew nothing at all because it spends no free space of its own. Every spot is
 * its own outline now, and every outline is exactly the box `SlotMark` fills and
 * the block takes.
 *
 * Deliberately not `SlotMark` with a prop. A resting spot has no settle and no
 * preview, so the shared version would be a component that is mostly branches on
 * which of the two it is.
 *
 * Drawing only. The hit areas are `DropSlot`s on the same layer and none of this
 * moves them: a spot is `pointer-events: none`, and the scale on it is a
 * transform, which changes nothing `elementFromPoint` reads.
 *
 * Two elements, one property each: the outer one pops, the inner one breathes.
 */
export function DropSpotOutline({
  band,
  line,
}: {
  band: DropBand;
  /** The line's own box — what a band with no `left` of its own spans. */
  line: CardDropGeometry["line"];
}) {
  return (
    <motion.div
      className="pointer-events-none absolute"
      style={{
        left: `${String(band.left ?? line.left)}px`,
        width: `${String(band.width ?? line.width)}px`,
        top: `${String(band.y)}px`,
        height: `${String(band.height)}px`,
      }}
      {...dropSpotMotion()}
    >
      <motion.div className="card-drop-spot size-full" {...dropSpotBreathMotion()} />
    </motion.div>
  );
}
