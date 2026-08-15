"use client";

import { ChevronRight, Pencil, Ungroup } from "lucide-react";
import { motion } from "motion/react";

import { LIST_ROW_CLASS, listRowMotion } from "@/components/ui/list-row-motion";
import { RowMenu } from "@/components/ui/row-menu";
import type { Group } from "@/lib/repositories/types";
import { useRowDrag, type DraggedObject } from "./use-row-drag";

/**
 * A group's header row.
 *
 * The one row in the sidebar that is not about a single object, so it reads
 * differently on purpose: a chevron on the left for the disclosure, the count on
 * the right where the plan badges sit. What it shares with the others is the
 * layout — same height, same hidden-until-hovered actions — because it is still
 * a row in the same list.
 *
 * Pressing it selects the whole group on the map and frames it. That is the
 * answer to "which of my locations are in this?", which a list of names indoors
 * cannot give.
 *
 * It is also a drop target: dragging a location onto the header puts it in the
 * group, which is the obvious gesture once the header exists, and the only one
 * that works for a group you have collapsed.
 */
export function GroupListItem({
  group,
  count,
  isOpen,
  isSelected,
  animateMoves = false,
  onToggle,
  onFocus,
  onEdit,
  onUngroup,
  onDropObject,
}: {
  group: Group;
  /** How many locations and shapes are in it. */
  count: number;
  isOpen: boolean;
  /** Its members are the current selection, so the row is lit like they are. */
  isSelected: boolean;
  /** Animate a change of position, not just of presence — see listRowMotion. */
  animateMoves?: boolean;
  onToggle: () => void;
  onFocus: () => void;
  onEdit: () => void;
  /** Take the group apart. Its members are kept — see the menu item's comment. */
  onUngroup: () => void;
  onDropObject?: (dragged: DraggedObject) => void;
}) {
  const { isTarget, rowProps, noDragProps } = useRowDrag({
    // A group is not a place or a shape, so it can be dropped *on* but never
    // dragged itself — dragging one group onto another would be a nesting
    // feature, and groups do not nest. `self` is only ever read to refuse a
    // self-drop, which is why the type is a lie nothing can act on.
    self: { type: "place", id: group.id },
    canDrag: false,
    onDropObject,
  });

  return (
    <motion.li {...listRowMotion(animateMoves)} className={LIST_ROW_CLASS}>
      {/* The row proper is this div, not the `li` — see PlaceListItem for why
          native drag handlers cannot live on a Motion element. */}
      <div
        data-selected={isSelected || undefined}
        data-drop-target={isTarget || undefined}
        {...rowProps}
        className="group flex h-12 items-center gap-1 rounded-xl px-2 transition-colors hover:bg-default data-drop-target:inset-ring-2 data-drop-target:inset-ring-accent data-selected:bg-accent-soft"
      >
        {/*
         * Its own control, and small: opening a group to see inside it and
         * selecting the group on the map are two different intentions, and one
         * button doing both means you cannot do either without the other.
         */}
        <button
          type="button"
          aria-expanded={isOpen}
          aria-label={isOpen ? `Collapse ${group.name}` : `Expand ${group.name}`}
          onClick={onToggle}
          className="flex size-6 shrink-0 cursor-pointer items-center justify-center rounded-md text-muted transition-colors hover:bg-default focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--focus)]"
        >
          <ChevronRight
            aria-hidden="true"
            className={`size-4 transition-transform duration-[var(--duration-fast)] ${
              isOpen ? "rotate-90" : ""
            }`}
          />
        </button>

        <button
          type="button"
          className="flex h-full min-w-0 flex-1 items-center gap-2 rounded-lg text-left outline-none focus-visible:inset-ring-2 focus-visible:inset-ring-focus"
          aria-current={isSelected ? "true" : undefined}
          onClick={onFocus}
        >
          {/* Square, where a location's is a dot and a shape's is a circle — the
              three row kinds are told apart by their swatch before their text. */}
          <span
            aria-hidden="true"
            className="size-3 shrink-0 rounded-xs border border-black/10"
            style={{ backgroundColor: group.color }}
          />

          <span className="min-w-0 flex-1">
            <span className="block truncate text-sm font-medium text-foreground">
              {group.name}
            </span>
          </span>

          <span className="shrink-0 text-xs text-muted tabular-nums">{count}</span>
        </button>

        {/* `noDragProps` keeps a press on the menu from starting a row drag —
            see useRowDrag. */}
        <div className="shrink-0" {...noDragProps}>
          <RowMenu
            label={`Actions for ${group.name}`}
            items={[
              { id: "rename", label: "Rename", icon: Pencil, onAction: onEdit },
              /* "Ungroup", not "Delete", and not a bin.

                 It was both, and the dialog behind it had to open by promising
                 that forty locations were not about to go with it. That promise
                 arrived a click too late: the icon had already said otherwise,
                 so the control people wanted was the one they were most afraid
                 of. Taking a group apart destroys the grouping and nothing else,
                 which is what "ungroup" means and what the bin was mis-stating.
                 §8 — name the control after what the user is doing.

                 In a named menu it finally gets to say so in words. */
              {
                id: "ungroup",
                label: "Ungroup",
                icon: Ungroup,
                onAction: onUngroup,
              },
            ]}
          />
        </div>
      </div>
    </motion.li>
  );
}
