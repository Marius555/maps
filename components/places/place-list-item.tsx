"use client";

import { Pencil, RotateCw, Trash2 } from "lucide-react";
import { motion } from "motion/react";

import { IconButton } from "@/components/ui/icon-button";
import type { MapCategory, Place } from "@/lib/repositories/types";
import { PlaceRowLabel } from "./place-row-label";

/**
 * One location in the list.
 *
 * The actions used to be two full-width text buttons that ate about half the row.
 * They are now icon-only and hidden until the row is hovered, focused or
 * selected, so the row is mostly the thing it is about.
 *
 * Hidden with `opacity`, never `hidden` or `sr-only`: the buttons must stay in the
 * DOM and in the tab order. `group-focus-within` is what makes them appear for a
 * keyboard user — without it this would be a mouse-only feature.
 */
export function PlaceListItem({
  place,
  category,
  isSelected,
  isAddressPending,
  hasAddressFailed,
  isDeleting,
  onSelect,
  onEdit,
  onDelete,
  onRetryAddress,
}: {
  place: Place;
  category: MapCategory | undefined;
  isSelected: boolean;
  /** Waiting on the address this row is about — see PlaceRowLabel. */
  isAddressPending?: boolean;
  /** The lookup answered with nothing, so the row offers another go. */
  hasAddressFailed?: boolean;
  isDeleting: boolean;
  onSelect: () => void;
  onEdit: () => void;
  onDelete: () => void;
  onRetryAddress?: () => void;
}) {
  // Only worth offering while there is still nothing to show. A location whose
  // address the customer has since typed has no failure left to retry.
  const canRetry = Boolean(
    hasAddressFailed && onRetryAddress && !isAddressPending && !place.address,
  );

  return (
    /*
     * Rows fade in and out so an added or deleted location is visibly *this* row
     * rather than the list silently being one longer.
     *
     * Opacity only — no `layout` prop. A 3,000-place map is within spec (§6), and
     * layout animations measure every sibling on every commit, which is a cost
     * paid on the largest lists precisely where it hurts most.
     */
    <motion.li
      layout={false}
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.15, ease: [0, 0, 0.2, 1] }}
      data-selected={isSelected || undefined}
      className="group flex h-12 items-center gap-1 rounded-xl px-2 transition-colors hover:bg-default data-selected:bg-accent-soft"
    >
      <button
        type="button"
        className="flex h-full min-w-0 flex-1 flex-col justify-center rounded-lg text-left outline-none focus-visible:inset-ring-2 focus-visible:inset-ring-focus"
        aria-current={isSelected ? "true" : undefined}
        // The skeleton is decorative, so the row would otherwise be a button with
        // no name at all for the second the lookup takes.
        aria-label={isAddressPending ? "Finding this address" : undefined}
        onClick={onSelect}
      >
        <PlaceRowLabel
          place={place}
          category={category}
          isPending={Boolean(isAddressPending)}
          hasFailed={Boolean(hasAddressFailed)}
        />
      </button>

      {/*
       * `group-focus-within`, not plain `focus-within`: focus lands on the row's
       * select button first, which is a sibling of this div. Without the group
       * variant a keyboard user would tab into buttons that are still invisible.
       */}
      {/*
       * Outside the cluster below, and never hidden. The others are actions you go
       * looking for; this one is the answer to a problem the row is currently
       * reporting, and revealing it on hover would leave the failure stated with
       * no way to act on it.
       */}
      {canRetry ? (
        <IconButton
          label={`Look up the address for ${place.name} again`}
          icon={RotateCw}
          onPress={onRetryAddress}
        />
      ) : null}

      <div className="flex shrink-0 items-center gap-0.5 opacity-0 transition-opacity group-focus-within:opacity-100 group-hover:opacity-100 group-data-selected:opacity-100">
        <IconButton label={`Edit ${place.name}`} icon={Pencil} onPress={onEdit} />
        <IconButton
          label={`Delete ${place.name}`}
          icon={Trash2}
          isPending={isDeleting}
          onPress={onDelete}
        />
      </div>
    </motion.li>
  );
}
