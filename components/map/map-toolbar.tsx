"use client";

import { Separator } from "@heroui/react";
import { Bookmark, Eye } from "lucide-react";
import { AnimatePresence, motion } from "motion/react";
import type { ReactNode } from "react";

import { IconButton } from "@/components/ui/icon-button";
import { AddLocationButton } from "./add-location/add-location-button";

/**
 * Map controls, in a floating panel.
 *
 * They used to be bare buttons sitting on the tiles — `tertiary` variant, which
 * is nearly transparent, so over a light basemap they were close to invisible.
 * Grouping them on a real surface gives them a background to sit on and reads as
 * one control cluster rather than several loose objects.
 *
 * Add mode keeps its text label because it is a mode you can be *in*, and an
 * icon alone can't say "currently on". The rest are icon buttons with tooltips.
 *
 * There is no "Add at centre" any more. A crosshair that drops a pin at whatever
 * the map happens to be centred on was a control looking for a purpose — the
 * centre of the viewport is not a place. Its one real job was being the keyboard
 * route to adding a location, and the search's add action does that better, at an
 * address the user actually chose.
 *
 * The add control and the search are both passed their behaviour rather than
 * reaching for it: this file stays a toolbar, and does not acquire a geocoder or
 * a pointer-gesture state machine.
 */
export function MapToolbar({
  isAdding,
  isBusy,
  isAddDisabled,
  isSavingView,
  hasSavedView,
  search,
  onToggleAdd,
  onDropPin,
  onDraggingChange,
  onSaveView,
  onPreview,
}: {
  isAdding: boolean;
  isBusy: boolean;
  /** At the plan's place limit — see AddLocationButton. */
  isAddDisabled?: boolean;
  isSavingView: boolean;
  /** Shows confirmation after a save, so the button's effect is visible. */
  hasSavedView: boolean;
  search?: ReactNode;
  onToggleAdd: () => void;
  /** A pin dragged out of the add control and dropped, in viewport coordinates. */
  onDropPin: (clientX: number, clientY: number) => void;
  onDraggingChange?: (isDragging: boolean) => void;
  onSaveView: () => void;
  onPreview: () => void;
}) {
  return (
    /*
     * `pr-12` on the row keeps the wrapping controls clear of MapLibre's own
     * NavigationControl, which sits at top-right inside the same box.
     */
    <div className="pointer-events-none absolute inset-x-2 top-2 z-10 flex flex-wrap items-start gap-2 pr-12">
      <div className="pointer-events-auto flex items-center gap-1 rounded-xl border border-border bg-surface p-1 shadow-sm">
        <AddLocationButton
          isAdding={isAdding}
          isBusy={isBusy}
          isDisabled={isAddDisabled}
          onToggleAdd={onToggleAdd}
          onDropPin={onDropPin}
          onDraggingChange={onDraggingChange}
        />

        <Separator orientation="vertical" className="h-6" />

        {/* The default view is where the map opens, for the owner and for every
            visitor of the embed. Setting it by panning beats typing coordinates. */}
        <IconButton
          label="Save this view as default"
          icon={Bookmark}
          placement="bottom"
          isPending={isSavingView}
          onPress={onSaveView}
        />

        {/* The editor canvas has no popups, clusters or filters — those are the
            embed's. This is the only place in the editor you can see them. */}
        <IconButton
          label="Preview as a visitor"
          icon={Eye}
          placement="bottom"
          onPress={onPreview}
        />
      </div>

      {search}

      {/* Confirmation, so pressing Save has a visible effect. It animates in and
          out because it is the entire acknowledgement — appearing and vanishing
          on a hard cut reads as a glitch rather than a reply. */}
      <AnimatePresence>
        {hasSavedView ? (
          <motion.span
            initial={{ opacity: 0, scale: 0.96 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.96 }}
            transition={{ duration: 0.15, ease: [0, 0, 0.2, 1] }}
            className="pointer-events-auto rounded-full border border-border bg-surface px-2.5 py-1 text-xs text-muted shadow-sm"
            role="status"
          >
            View saved
          </motion.span>
        ) : null}
      </AnimatePresence>
    </div>
  );
}
