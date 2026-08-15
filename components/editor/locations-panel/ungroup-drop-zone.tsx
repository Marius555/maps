"use client";

import { Ungroup } from "lucide-react";
import { AnimatePresence, motion } from "motion/react";
import { useState, type DragEvent } from "react";

import { useRowDragState } from "@/components/groups/row-drag-context";
import {
  DRAG_MIME,
  readDraggedObject,
  type DraggedObject,
} from "@/components/groups/use-row-drag";

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
  const [isTarget, setIsTarget] = useState(false);

  const isOffered = dragged !== null && isGrouped(dragged);

  const onDragOver = (event: DragEvent) => {
    if (!event.dataTransfer.types.includes(DRAG_MIME)) return;

    // Without this the browser refuses the drop, and `onDrop` never fires.
    event.preventDefault();
    event.dataTransfer.dropEffect = "move";
    setIsTarget(true);
  };

  const onDrop = (event: DragEvent) => {
    setIsTarget(false);

    const object = readDraggedObject(event.dataTransfer);
    if (!object) return;

    event.preventDefault();
    onUngroup(object);
  };

  return (
    <AnimatePresence>
      {isOffered ? (
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: 8 }}
          transition={{ duration: 0.15, ease: [0, 0, 0.2, 1] }}
          className="border-t border-border p-2"
        >
          <div
            data-drop-target={isTarget || undefined}
            onDragOver={onDragOver}
            onDragLeave={() => setIsTarget(false)}
            onDrop={onDrop}
            className="flex h-12 items-center justify-center gap-2 rounded-xl border border-dashed border-border text-xs text-muted transition-colors data-drop-target:border-solid data-drop-target:border-accent data-drop-target:bg-accent-soft data-drop-target:text-foreground"
          >
            <Ungroup aria-hidden="true" className="size-4" />
            {/* The name the row menu uses for the same outcome (§8). */}
            Remove from group
          </div>
        </motion.div>
      ) : null}
    </AnimatePresence>
  );
}
