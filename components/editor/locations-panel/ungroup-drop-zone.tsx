"use client";

import { Ungroup } from "lucide-react";
import { AnimatePresence, motion } from "motion/react";

import { useRowDragState } from "@/components/groups/row-drag-context";
import { useDropTarget, type DraggedObject } from "@/components/groups/use-row-drag";
import { GESTURE_SPRING } from "@/components/ui/list-row-motion";

/**
 * Somewhere to drop a row that is leaving its group.
 *
 * Every other drop target in this panel is a row, which works because every
 * other gesture has a row to aim at: joining a group means landing on one of its
 * members or on its header. Leaving one has no such thing. Dropping into the
 * loose run below would have been the obvious guess, and it is the wrong one —
 * dropping on a loose row already means "make a new group holding both of us",
 * and one gesture cannot mean two things.
 *
 * So a strip of its own, pinned under the list rather than inside it. Inside, a
 * long list would push it out of reach exactly when the user is dragging.
 *
 * Shown only while something that *is* in a group is in the air. A permanent
 * "remove from group" target would be a control that does nothing almost all of
 * the time, and offering it during a drag that could not use it would be worse
 * than not offering it at all.
 *
 * It used to say all of that in a dashed grey outline and muted text, which is
 * the vocabulary of a hint — and people missed it, because a hint is exactly what
 * it looked like while they were busy aiming at something else. It is a control,
 * and it now reads as one from the moment it arrives: tinted, ringed in the
 * accent, in full-strength text. The escalation on hover is what it always had;
 * what it was missing was a resting state loud enough to be noticed at all.
 */
export function UngroupDropZone({
  /** Answers "is this one in a group?" — the panel knows, this does not. */
  isGrouped,
  onUngroup,
}: {
  isGrouped: (dragged: DraggedObject) => boolean;
  onUngroup: (dragged: DraggedObject) => void;
}) {
  const { dragged } = useRowDragState();

  const { targetProps } = useDropTarget({
    id: "ungroup",
    accepts: isGrouped,
    onDrop: onUngroup,
  });

  const isOffered = dragged !== null && isGrouped(dragged);

  return (
    <AnimatePresence>
      {isOffered ? (
        <motion.div
          /*
           * Overshoots a little on the way in. Half of what makes a target easy
           * to miss is that it appears the way a static thing would — this
           * arrives, and movement is the one signal that reaches someone whose
           * attention is on the row under their pointer.
           *
           * Motion respects `prefers-reduced-motion` for transforms through its
           * own reduced-motion handling, and the strip is legible without the
           * movement because the resting state carries the emphasis.
           *
           * `GESTURE_SPRING` is these numbers, exported so the card designer's
           * removal wall arrives with the same weight rather than with a second
           * spring that happens to agree today.
           */
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: 12 }}
          transition={GESTURE_SPRING}
          className="border-t border-border p-2"
        >
          <div
            {...targetProps}
            className="flex h-14 items-center justify-center gap-2 rounded-xl border-2 border-dashed border-accent/55 bg-accent-soft/50 text-sm font-medium text-foreground transition-colors data-drop-target:border-solid data-drop-target:border-accent data-drop-target:bg-accent-soft"
          >
            <Ungroup aria-hidden="true" className="size-5 text-accent" />
            {/* The name the row menu uses for the same outcome (§8). */}
            Remove from group
          </div>
        </motion.div>
      ) : null}
    </AnimatePresence>
  );
}
