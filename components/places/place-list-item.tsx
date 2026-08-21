"use client";

import { Pencil, RotateCw, Trash2, Ungroup } from "lucide-react";
import { motion } from "motion/react";

import {
  NO_DRAG_PROPS,
  useDropTarget,
  useRowDragSource,
  type DraggedObject,
} from "@/components/groups/use-row-drag";
import { PinPreview } from "@/components/map/pin-preview";
import { LIST_ROW_CLASS, listRowMotion } from "@/components/ui/list-row-motion";
import { RowMenu, type RowMenuItem } from "@/components/ui/row-menu";
import { TreeBranch } from "@/components/ui/tree-branch";
import type { MapCategory, Place } from "@/lib/repositories/types";
import type { CustomPinIcon } from "@/packages/shared/pin-icons";
import { PlaceRowLabel } from "./place-row-label";

/**
 * One location in the list.
 *
 * The actions were two full-width text buttons, then three icon buttons revealed
 * on hover, and are now one menu — see `RowMenu` for why. What is left beside the
 * name is what says *which* location this is: its pin and its status flag.
 *
 * The pin is the pin. It was a plain coloured dot, which meant a location with
 * no category and no group drew *nothing at all* — the commonest row on a new
 * map identified itself with an empty space — and a location whose owner had
 * gone and picked a coffee cup for it showed no sign of that anywhere but the
 * canvas. `PinPreview` draws the same `pinSvg` the marker does, and `pinSvg`
 * with no icon is still a ball, so every row has something true to show.
 */
export function PlaceListItem({
  place,
  category,
  pinIcons,
  groupColor,
  isSelected,
  isAddressPending,
  hasAddressFailed,
  indent,
  isLastInGroup = false,
  startsLooseSection,
  animateMoves = false,
  canDrag = false,
  onSelect,
  onEdit,
  onDelete,
  onRetryAddress,
  onRemoveFromGroup,
  onDropObject,
  acceptsDrop,
}: {
  place: Place;
  category: MapCategory | undefined;
  /** The map's own pins, so `custom:<id>` on a place resolves to a drawing. */
  pinIcons: CustomPinIcon[];
  /** Set for a row in a group: the group's colour, which its pin now wears. */
  groupColor?: string;
  isSelected: boolean;
  /** Waiting on the address this row is about — see PlaceRowLabel. */
  isAddressPending?: boolean;
  /** The lookup answered with nothing, so the row offers another go. */
  hasAddressFailed?: boolean;
  /**
   * Inside a group. The step in from the left says so, and the rail beside it
   * says *which* group — see `TreeBranch`.
   */
  indent?: boolean;
  /** The last member of its group: the rail ends here rather than running on. */
  isLastInGroup?: boolean;
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
  /**
   * Whether this row would do anything with what is currently in the air.
   *
   * A row that cannot use a drop stays dark as the pointer crosses it, rather
   * than lighting up and then declining on release — see lib/map/drop-action.ts.
   */
  acceptsDrop?: (dragged: DraggedObject) => boolean;
}) {
  // Only worth offering while there is still nothing to show. A location whose
  // address the customer has since typed has no failure left to retry.
  const canRetry = Boolean(
    hasAddressFailed && onRetryAddress && !isAddressPending && !place.address,
  );

  const { isDraggable, rowProps } = useRowDragSource({
    self: { type: "place", id: place.id },
    canDrag,
  });

  // `targetProps` carries the id the hit test looks for *and* the
  // `data-drop-target` flag the highlight keys off, so nothing else is needed
  // here — the two cannot drift into a row that lights up and does nothing.
  const { targetProps } = useDropTarget({
    id: `place:${place.id}`,
    accepts: acceptsDrop ?? ALWAYS,
    onDrop: onDropObject,
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
      // `flex` so the tree rail can sit *beside* the row rather than inside it —
      // see TreeBranch. `ms-4` rather than padding, so the step in from the left
      // is a change of *position* and `layout` animates it along with everything
      // else.
      className={`${LIST_ROW_CLASS} flex${indent ? " ms-4" : ""}${
        startsLooseSection ? " mt-2 border-t border-border pt-2" : ""
      }`}
    >
      {indent ? <TreeBranch color={groupColor} isLast={isLastInGroup} /> : null}

      {/*
       * The row proper is this div, not the `li`. Motion owns the `li`'s pointer
       * handlers for its own gestures, and the drop target has to be an element
       * with a stable box the hit test can find — a `motion.li` mid-layout
       * animation is neither.
       */}
      <div
        data-selected={isSelected || undefined}
        {...targetProps}
        {...rowProps}
        className={`group flex h-12 min-w-0 flex-1 items-center gap-1 rounded-xl px-2 transition-colors hover:bg-default data-drop-target:inset-ring-2 data-drop-target:inset-ring-accent data-selected:bg-accent-soft${
          isDraggable ? " is-draggable" : ""
        }`}
      >
        {/* Pin outside the text block, not on its first line. Beside both lines
            it reads as the row's subject rather than as punctuation in front of
            the address, and it leaves the left edge free for the group rail. */}
        <button
          type="button"
          className="flex h-full min-w-0 flex-1 items-center gap-2 rounded-lg text-left outline-none focus-visible:inset-ring-2 focus-visible:inset-ring-focus"
          aria-current={isSelected ? "true" : undefined}
          // The skeleton is decorative, so the row would otherwise be a button
          // with no name at all for the second the lookup takes.
          aria-label={isAddressPending ? "Finding this address" : undefined}
          onClick={onSelect}
        >
          <PinPreview
            icon={place.icon}
            pinIcons={pinIcons}
            color={groupColor}
            fallbackColor={category?.color}
            size="sm"
            className="shrink-0"
          />

          <span className="flex min-w-0 flex-1 flex-col justify-center">
            <PlaceRowLabel
              place={place}
              isPending={Boolean(isAddressPending)}
              hasFailed={Boolean(hasAddressFailed)}
            />
          </span>
        </button>

        {/* `NO_DRAG_PROPS` stops a press on the menu from also picking the row
            up — see useRowDragSource. */}
        <div className="shrink-0" {...NO_DRAG_PROPS}>
          <RowMenu label={`Actions for ${place.name}`} items={items} />
        </div>
      </div>
    </motion.li>
  );
}

/** A row with no rule of its own takes anything. Hoisted so it is one identity. */
const ALWAYS = () => true;
