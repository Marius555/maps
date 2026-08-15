"use client";

import { useCallback, useState, type DragEvent } from "react";

import { useRowDragState } from "./row-drag-context";

/**
 * Dragging one row onto another to group them.
 *
 * Native HTML5 drag-and-drop, and no library. The whole gesture is "pick up one
 * row, drop it on one other row" — no sortable list, no reordering, no drop
 * indicators between items. A drag-and-drop package would be a dependency (§3
 * says ask first) bought for four event handlers.
 *
 * It works alongside HeroUI's `usePress`, which ends its `pointerdown` with
 * `stopPropagation()`: `dragstart` is a separate event the browser raises from
 * the draggable element itself, so the workaround
 * `components/map/add-location/use-drag-to-add.ts` needs does not apply here.
 */

/**
 * Our own MIME type, so a file or a link dragged in from elsewhere is ignored.
 *
 * Exported for the ungroup strip, which is a drop target without being a row and
 * so has to run the same guard by hand.
 */
export const DRAG_MIME = "application/x-map-object";

export type DraggedObject = {
  type: "place" | "shape";
  id: string;
};

/**
 * What a row exposes so another row can be dropped on it, and so it can be
 * dragged onto one.
 */
export function useRowDrag({
  self,
  canDrag = true,
  onDropObject,
}: {
  /** What this row is, for when it is the one being dragged. */
  self: DraggedObject;
  /**
   * Whether this row can be picked up at all.
   *
   * False on the Locations tab, where nothing accepts a drop: a row that is
   * draggable but has nowhere to go advertises a gesture that silently does
   * nothing, and now that rows show a grab cursor it would advertise it in the
   * one place the user is guaranteed to see.
   */
  canDrag?: boolean;
  /** Something was dropped on this row. Undefined makes the row a non-target. */
  onDropObject?: (dragged: DraggedObject) => void;
}) {
  const [isTarget, setIsTarget] = useState(false);
  const { setDragged } = useRowDragState();

  /*
   * The row stops being draggable while the pointer is over its own controls.
   *
   * `dragstart` fires on the draggable element itself, which is the row — so a
   * child cannot cancel it by stopping propagation, and `draggable={false}` on a
   * child does not apply either, because the drag source is the nearest
   * draggable *ancestor*. Taking the attribute off the row for as long as the
   * pointer is on a control is the one thing that works.
   *
   * Without it, press-and-twitch on the actions menu drags the row instead of
   * opening the menu, and the menu never gets its click.
   *
   * It is cleared by entering the row as well as by leaving the control, and
   * that second reset is not belt-and-braces. Opening the actions menu takes the
   * pointer capture React Aria's `usePress` sets, and a captured pointer stops
   * firing boundary events — so the `pointerleave` that would have cleared this
   * never arrives, and the row is left permanently undraggable. It was invisible
   * until the rows started showing a grab cursor; now the cursor says so.
   */
  const [isOverControl, setIsOverControl] = useState(false);
  const isDraggable = canDrag && !isOverControl;

  const onDragStart = useCallback(
    (event: DragEvent) => {
      event.dataTransfer.setData(DRAG_MIME, JSON.stringify(self));
      event.dataTransfer.effectAllowed = "move";

      // Published so the panel can offer somewhere to drop that is not a row —
      // see row-drag-context.tsx.
      setDragged(self);
    },
    [self, setDragged],
  );

  /*
   * `dragend` fires on the source for a completed drop and for a cancelled one
   * alike, so this is the one handler that is guaranteed to run. Clearing on
   * `drop` instead would leave the state stuck whenever the user let go over
   * nothing.
   */
  const onDragEnd = useCallback(() => {
    setIsTarget(false);
    setDragged(null);
  }, [setDragged]);

  const onDragOver = useCallback(
    (event: DragEvent) => {
      if (!onDropObject) return;
      if (!event.dataTransfer.types.includes(DRAG_MIME)) return;

      // Without this the browser refuses the drop, and `onDrop` never fires.
      event.preventDefault();
      event.dataTransfer.dropEffect = "move";
      setIsTarget(true);
    },
    [onDropObject],
  );

  const onDragLeave = useCallback((event: DragEvent) => {
    /*
     * `dragleave` also fires when the pointer crosses into a child of this row —
     * its buttons, its label — which would flicker the highlight off and on for
     * the whole hover. Only a `relatedTarget` outside the row is a real leave.
     */
    const next = event.relatedTarget;
    if (next instanceof Node && event.currentTarget.contains(next)) return;

    setIsTarget(false);
  }, []);

  const onDrop = useCallback(
    (event: DragEvent) => {
      setIsTarget(false);
      if (!onDropObject) return;

      const dragged = readDraggedObject(event.dataTransfer);
      if (!dragged) return;

      event.preventDefault();

      // Dropping a row on itself is a mis-drop, not a group of one.
      if (dragged.type === self.type && dragged.id === self.id) return;

      onDropObject(dragged);
    },
    [onDropObject, self],
  );

  return {
    isTarget,
    /** True while the row would actually pick up — what the cursor should say. */
    isDraggable,
    rowProps: {
      draggable: isDraggable,
      onDragStart,
      onDragOver,
      onDragLeave,
      onDrop,
      onDragEnd,
      /*
       * `pointerenter` does not bubble and fires only on the way in from outside
       * the row, so this never fights the control's own enter — that one fires
       * second, being the inner element.
       */
      onPointerEnter: () => setIsOverControl(false),
    },
    /** Spread on anything inside the row that is pressed rather than dragged. */
    noDragProps: {
      onPointerEnter: () => setIsOverControl(true),
      onPointerLeave: () => setIsOverControl(false),
    },
  };
}

/**
 * What is being dragged, or null for anything that is not one of our rows.
 *
 * Exported so the ungroup strip reads the payload the same way a row does rather
 * than keeping a second copy of the MIME type and the guard.
 */
export function readDraggedObject(
  dataTransfer: DataTransfer,
): DraggedObject | null {
  const raw = dataTransfer.getData(DRAG_MIME);

  return raw ? parse(raw) : null;
}

/** Never throws: a payload from another tab or an older version is just ignored. */
function parse(raw: string): DraggedObject | null {
  try {
    const value: unknown = JSON.parse(raw);
    if (typeof value !== "object" || value === null) return null;

    const { type, id } = value as Partial<DraggedObject>;
    if (type !== "place" && type !== "shape") return null;
    if (typeof id !== "string" || !id) return null;

    return { type, id };
  } catch {
    return null;
  }
}
