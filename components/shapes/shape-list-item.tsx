"use client";

import { Pencil, Trash2, Ungroup } from "lucide-react";
import { motion } from "motion/react";

import {
  NO_DRAG_PROPS,
  useDropTarget,
  useRowDragSource,
  type DraggedObject,
} from "@/components/groups/use-row-drag";
import { LIST_ROW_CLASS, listRowMotion } from "@/components/ui/list-row-motion";
import { RowMenu, type RowMenuItem } from "@/components/ui/row-menu";
import { TreeBranch } from "@/components/ui/tree-branch";
import { shapeSummary } from "@/lib/map/shape-summary";
import type { Shape } from "@/lib/repositories/types";
import { ShapeIcon } from "./shape-icon";

/**
 * One shape in the list.
 *
 * Structurally `PlaceListItem`, down to the single actions menu — see `RowMenu`.
 *
 * The swatch is the row's identity. A shape's name is whatever the customer
 * typed — often "Zone 1", "Zone 2" — and the colour is what actually connects
 * this row to the wash of colour on the map. It is an outline rather than a dot,
 * and the outline is the shape's own kind: see `ShapeIcon`.
 */
export function ShapeListItem({
  shape,
  groupColor,
  isSelected,
  indent,
  isLastInGroup = false,
  startsLooseSection,
  animateMoves = false,
  canDrag = false,
  onSelect,
  onEdit,
  onDelete,
  onRemoveFromGroup,
  onDropObject,
  acceptsDrop,
}: {
  shape: Shape;
  /** Set for a row in a group: what the shape is actually painted on the map. */
  groupColor?: string;
  isSelected: boolean;
  /** Inside a group. The step in and the rail beside it are what say so. */
  indent?: boolean;
  /** The last member of its group: the rail ends here rather than running on. */
  isLastInGroup?: boolean;
  /** The first row below the groups — see PlaceListItem. */
  startsLooseSection?: boolean;
  /** Animate a change of position, not just of presence — see listRowMotion. */
  animateMoves?: boolean;
  /** Whether this row can be picked up. Only the editor sidebar takes drops. */
  canDrag?: boolean;
  onSelect: () => void;
  onEdit: () => void;
  onDelete: () => void;
  /** Only passed for a row in a group — see the menu item. */
  onRemoveFromGroup?: () => void;
  /** Another row was dropped on this one. Omit and the row is not a drop target. */
  onDropObject?: (dragged: DraggedObject) => void;
  /** Whether this row would do anything with what is in the air — see PlaceListItem. */
  acceptsDrop?: (dragged: DraggedObject) => boolean;
}) {
  const { isDraggable, rowProps } = useRowDragSource({
    self: { type: "shape", id: shape.id },
    canDrag,
  });

  // `targetProps` carries both the hit-test id and the highlight flag — see
  // PlaceListItem.
  const { targetProps } = useDropTarget({
    id: `shape:${shape.id}`,
    accepts: acceptsDrop ?? ALWAYS,
    onDrop: onDropObject,
  });

  const items: RowMenuItem[] = [
    { id: "edit", label: "Edit", icon: Pencil, onAction: onEdit },
  ];

  // Only when there is a group to leave — the same rule PlaceListItem follows.
  if (onRemoveFromGroup) {
    items.push({
      id: "ungroup",
      label: "Remove from group",
      icon: Ungroup,
      onAction: onRemoveFromGroup,
    });
  }

  items.push({
    id: "delete",
    label: "Delete",
    icon: Trash2,
    isDanger: true,
    onAction: onDelete,
  });

  return (
    <motion.li
      {...listRowMotion(animateMoves)}
      // `flex` so the tree rail sits beside the row rather than inside it — see
      // TreeBranch and PlaceListItem.
      className={`${LIST_ROW_CLASS} flex${indent ? " ms-4" : ""}${
        startsLooseSection ? " mt-2 border-t border-border pt-2" : ""
      }`}
    >
      {indent ? <TreeBranch color={groupColor} isLast={isLastInGroup} /> : null}

      {/* The row proper is this div, not the `li` — see PlaceListItem for why
          the drop target cannot live on a Motion element. */}
      <div
        data-selected={isSelected || undefined}
        {...targetProps}
        {...rowProps}
        className={`group flex h-12 min-w-0 flex-1 items-center gap-1 rounded-xl px-2 transition-colors hover:bg-default data-drop-target:inset-ring-2 data-drop-target:inset-ring-accent data-selected:bg-accent-soft${
          isDraggable ? " is-draggable" : ""
        }`}
      >
        <button
          type="button"
          className="flex h-full min-w-0 flex-1 items-center gap-2 rounded-lg text-left outline-none focus-visible:inset-ring-2 focus-visible:inset-ring-focus"
          aria-current={isSelected ? "true" : undefined}
          onClick={onSelect}
        >
          <ShapeIcon
            geometry={shape.geometry}
            color={groupColor ?? shape.color}
          />

          <span className="min-w-0">
            <span className="block truncate text-sm text-foreground">
              {shape.name}
            </span>
            <span className="block truncate text-xs text-muted">
              {shapeSummary(shape.geometry)}
            </span>
          </span>
        </button>

        {/* `NO_DRAG_PROPS` stops a press on the menu from also picking the row
            up — see useRowDragSource. */}
        <div className="shrink-0" {...NO_DRAG_PROPS}>
          <RowMenu label={`Actions for ${shape.name}`} items={items} />
        </div>
      </div>
    </motion.li>
  );
}

/** A row with no rule of its own takes anything. Hoisted so it is one identity. */
const ALWAYS = () => true;
