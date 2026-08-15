"use client";

import { Pencil, RotateCw, Trash2, Ungroup } from "lucide-react";
import { motion } from "motion/react";

import { useRowDrag, type DraggedObject } from "@/components/groups/use-row-drag";
import { LIST_ROW_CLASS, listRowMotion } from "@/components/ui/list-row-motion";
import { RowMenu, type RowMenuItem } from "@/components/ui/row-menu";
import type { MapCategory, Place } from "@/lib/repositories/types";
import { PlaceRowLabel } from "./place-row-label";

/**
 * One location in the list.
 *
 * The actions were two full-width text buttons, then three icon buttons revealed
 * on hover, and are now one menu — see `RowMenu` for why. What is left beside the
 * name is what says *which* location this is: its category dot and its status
 * flag.
 */
export function PlaceListItem({
  place,
  category,
  groupColor,
  isSelected,
  isAddressPending,
  hasAddressFailed,
  indent,
  startsLooseSection,
  animateMoves = false,
  canDrag = false,
  onSelect,
  onEdit,
  onDelete,
  onRetryAddress,
  onRemoveFromGroup,
  onDropObject,
}: {
  place: Place;
  category: MapCategory | undefined;
  /** Set for a row in a group: the group's colour, which its pin now wears. */
  groupColor?: string;
  isSelected: boolean;
  /** Waiting on the address this row is about — see PlaceRowLabel. */
  isAddressPending?: boolean;
  /** The lookup answered with nothing, so the row offers another go. */
  hasAddressFailed?: boolean;
  /** Inside a group. The step in from the left is what says so. */
  indent?: boolean;
  /**
   * The first row below the groups. It carries the rule between the two, which
   * used to be a border on a `<section>` wrapper — see lib/map/sidebar-rows.ts.
   */
  startsLooseSection?: boolean;
  /** Animate a change of position, not just of presence — see listRowMotion. */
  animateMoves?: boolean;
  /** Whether this row can be picked up. Only the editor sidebar takes drops. */
  canDrag?: boolean;
  onSelect: () => void;
  onEdit: () => void;
  onDelete: () => void;
  onRetryAddress?: () => void;
  /** Only passed for a row in a group — see the menu item. */
  onRemoveFromGroup?: () => void;
  /** Another row was dropped on this one. Omit and the row is not a drop target. */
  onDropObject?: (dragged: DraggedObject) => void;
}) {
  // Only worth offering while there is still nothing to show. A location whose
  // address the customer has since typed has no failure left to retry.
  const canRetry = Boolean(
    hasAddressFailed && onRetryAddress && !isAddressPending && !place.address,
  );

  const { isTarget, isDraggable, rowProps, noDragProps } = useRowDrag({
    self: { type: "place", id: place.id },
    canDrag,
    onDropObject,
  });

  const items: RowMenuItem[] = [
    { id: "edit", label: "Edit", icon: Pencil, onAction: onEdit },
  ];

  /*
   * In the menu with the rest, and only while it would do something.
   *
   * It was a separate always-visible button, on the argument that a fix for a
   * problem the row is *currently reporting* should not be hidden behind a
   * hover. The row still reports it — PlaceRowLabel says "Couldn't find an
   * address" in plain text — so the problem is as visible as it was; only the
   * remedy moved, and it moved somewhere it can be named rather than drawn as an
   * arrow and guessed at.
   */
  if (canRetry && onRetryAddress) {
    items.push({
      id: "retry",
      label: "Find address again",
      icon: RotateCw,
      onAction: onRetryAddress,
    });
  }

  // Only when there is a group to leave. Dragging a row onto another is how
  // things get *into* a group; this is the way back out, short of taking the
  // whole group apart.
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
    /*
     * Rows fade in and out so an added or deleted location is visibly *this* row
     * rather than the list silently being one longer — and, under the size cap,
     * they travel when they change group rather than vanishing here and
     * reappearing there. See components/ui/list-row-motion.ts.
     */
    <motion.li
      {...listRowMotion(animateMoves)}
      // `ms-4` rather than padding, so the step in from the left is a change of
      // *position* and `layout` animates it along with everything else.
      className={`${LIST_ROW_CLASS}${indent ? " ms-4" : ""}${
        startsLooseSection ? " mt-2 border-t border-border pt-2" : ""
      }`}
    >
      {/*
       * The row proper is this div, not the `li`. Motion claims `onDragStart`
       * and `onDragEnd` for its own pan gesture and does not forward them to the
       * DOM, so native drag-and-drop handlers on a `motion.li` are swallowed
       * without an error. A plain element inside it gets them intact.
       */}
      <div
        data-selected={isSelected || undefined}
        data-drop-target={isTarget || undefined}
        {...rowProps}
        className={`group flex h-12 items-center gap-1 rounded-xl px-2 transition-colors hover:bg-default data-drop-target:inset-ring-2 data-drop-target:inset-ring-accent data-selected:bg-accent-soft${
          isDraggable ? " cursor-grab active:cursor-grabbing" : ""
        }`}
      >
        <button
          type="button"
          className="flex h-full min-w-0 flex-1 flex-col justify-center rounded-lg text-left outline-none focus-visible:inset-ring-2 focus-visible:inset-ring-focus"
          aria-current={isSelected ? "true" : undefined}
          // The skeleton is decorative, so the row would otherwise be a button
          // with no name at all for the second the lookup takes.
          aria-label={isAddressPending ? "Finding this address" : undefined}
          onClick={onSelect}
        >
          <PlaceRowLabel
            place={place}
            category={category}
            dotColor={groupColor}
            isPending={Boolean(isAddressPending)}
            hasFailed={Boolean(hasAddressFailed)}
          />
        </button>

        {/* `noDragProps` stops the row being dragged out from under the menu —
            see useRowDrag. */}
        <div className="shrink-0" {...noDragProps}>
          <RowMenu label={`Actions for ${place.name}`} items={items} />
        </div>
      </div>
    </motion.li>
  );
}
