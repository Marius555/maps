"use client";

import { Trash2 } from "lucide-react";
import { motion } from "motion/react";

import { useDropTarget } from "@/components/groups/use-row-drag";
import { wallMotion } from "@/components/ui/list-row-motion";

/** The one drop target that deletes. Read by the workspace too, for the ghost. */
export const REMOVE_DROP_ID = "card:remove";

/**
 * Where a block goes to be thrown away: a wall down the right of the workspace.
 *
 * Removal used to be "release it anywhere that is not the card", which is a
 * gesture with no edges — it had to be described in words on a pill at the
 * bottom of the screen and outlined in red all the way round, and it still fired
 * on a drag someone had simply given up on. A target you can aim at needs none
 * of that: the wall is either under the pointer or it is not.
 *
 * **It starts beside the card and runs to the workspace's own edge.** Both
 * halves of that matter, and each answers a version this replaces. A full-height
 * strip pinned to the *far* right of the canvas column was a long way from the
 * thing being dragged, so a removal meant carrying a block across empty space to
 * a target with no relationship to the card. A 4rem pill floating beside the
 * card fixed the distance and gave back the size — a square the width of a
 * thumbnail, to be hit while the pointer is already moving. This is both: its
 * left edge is 20px off the card, where the hand already is, and from there it
 * fills everything left over.
 *
 * That left edge is arithmetic rather than a measurement, because the card is
 * centred in the workspace by symmetric padding: `50% + width/2` *is* its right
 * edge, and `--card-w` carries the width the owner chose. The `min()` is what
 * makes it safe with no observer — on a workspace too narrow to fit a wall
 * beside the card (a phone, or a 480px card at the `lg` breakpoint) the clamp
 * wins and it sits just inside the workspace's own right edge.
 *
 * **A wall, not a panel.** The other three edges come from `.card-remove-zone`
 * in globals.css: top, bottom and right are flush to the workspace, so the only
 * edge drawn is the left one facing the hand, and the whole thing slides in from
 * beyond the frame rather than scaling up in place. A thing that arrives from a
 * direction reads as summoned by the gesture; a thing that grows where it stands
 * reads as a dialog.
 *
 * **Absolutely positioned, and that is load-bearing.** It appears in the middle
 * of a drag, and anything that appears mid-drag and takes part in the layout
 * moves the card the pointer is aiming at. Out of the flow it cannot.
 *
 * Only while a *placed* block is in the air — the caller decides that, so the
 * whole thing can be mounted and unmounted under `AnimatePresence`. A chip still
 * on its way off the palette has nothing to delete, and offering to delete it
 * would be offering to undo an add that has not happened.
 */
export function BlockRemoveZone({
  onRemove,
}: {
  onRemove: (id: string) => void;
}) {
  const { isTarget, targetProps } = useDropTarget({
    id: REMOVE_DROP_ID,
    accepts: (candidate) => candidate.type === "card-block",
    onDrop: (candidate) => onRemove(candidate.id),
  });

  return (
    /*
     * Two elements, because the slide has to be clipped.
     *
     * This one holds still and hides what overflows it; the one inside slides in
     * from beyond its right edge. Animating the outer element instead put a
     * translated box past the right edge of a scrollable parent, which grows
     * that parent's scrollable width — so picking up a block made a horizontal
     * scrollbar appear and shifted the page under the pointer.
     *
     * Its geometry is entirely in the stylesheet now (`.card-remove-zone`),
     * including the width, which is derived from `--card-w`: it wants to be the
     * gap between the card and the workspace's right edge, but clamped, because
     * on a wide screen beside a narrow card that gap is half the workspace and a
     * red slab that size is not a target, it is an alarm.
     */
    <motion.div
      aria-hidden="true"
      className="card-remove-zone"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.15, ease: [0, 0, 0.2, 1] }}
    >
      <motion.div {...wallMotion()} className="card-remove-zone__slide">
        <div {...targetProps} className="card-remove-zone__hit">
          <div
            className={`card-remove-pill ${isTarget ? "card-remove-pill--active" : ""}`}
          >
            {/*
             * Only the icon breathes. The halo used to sit on the whole pill, so
             * a 4rem square pulsed as one thing — at this size that is a column
             * the height of the workspace swelling in and out beside the card,
             * which reads as the page having a problem rather than as a target
             * waiting. The icon is the part that says what the wall does, so it
             * is the part that moves.
             *
             * The halo is its own element rather than a shadow on the icon, so
             * the breathing and the pill's own active state are two properties
             * on two elements and never fight over one.
             */}
            <span className="card-remove-pill__icon">
              <span aria-hidden="true" className="card-remove-pill__halo" />
              <Trash2 className="relative size-6 shrink-0" />
            </span>
            <span className="relative text-[0.6rem] font-medium">Remove</span>
          </div>
        </div>
      </motion.div>
    </motion.div>
  );
}
