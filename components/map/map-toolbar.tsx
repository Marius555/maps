"use client";

import { Button, Separator } from "@heroui/react";
import { Bookmark, Crosshair, MapPin } from "lucide-react";

import { IconButton } from "@/components/ui/icon-button";

/**
 * Map controls, in a floating panel.
 *
 * They used to be three bare buttons sitting on the tiles — `tertiary` variant,
 * which is nearly transparent, so over a light basemap they were close to
 * invisible. Grouping them on a real surface gives them a background to sit on
 * and reads as one control cluster rather than three loose objects.
 *
 * Add mode keeps its text label because it is a mode you can be *in*, and an
 * icon alone can't say "currently on". The rest are icon buttons with tooltips.
 */
export function MapToolbar({
  isAdding,
  isBusy,
  isSavingView,
  hasSavedView,
  onToggleAdd,
  onAddAtCentre,
  onSaveView,
}: {
  isAdding: boolean;
  isBusy: boolean;
  isSavingView: boolean;
  /** Shows confirmation after a save, so the button's effect is visible. */
  hasSavedView: boolean;
  onToggleAdd: () => void;
  onAddAtCentre: () => void;
  onSaveView: () => void;
}) {
  return (
    <div className="pointer-events-none absolute inset-x-2 top-2 z-10 flex flex-wrap items-start gap-2">
      <div className="pointer-events-auto flex items-center gap-1 rounded-xl border border-border bg-surface p-1 shadow-sm">
        <Button
          size="sm"
          variant={isAdding ? "primary" : "tertiary"}
          aria-pressed={isAdding}
          isPending={isBusy}
          onPress={onToggleAdd}
        >
          <MapPin aria-hidden="true" className="size-4" />
          {isAdding ? "Stop adding" : "Add location"}
        </Button>

        <Separator orientation="vertical" className="h-6" />

        {/* Clicking the map is mouse-only. This is the keyboard path to the same
            result — §8's quality floor, not a nice-to-have. */}
        <IconButton
          label="Add at centre"
          icon={Crosshair}
          placement="bottom"
          onPress={onAddAtCentre}
        />

        {/* The default view is where the map opens, for the owner and for every
            visitor of the embed. Setting it by panning beats typing coordinates. */}
        <IconButton
          label="Save this view as default"
          icon={Bookmark}
          placement="bottom"
          isPending={isSavingView}
          onPress={onSaveView}
        />
      </div>

      {hasSavedView ? (
        <span
          className="pointer-events-auto rounded-full border border-border bg-surface px-2.5 py-1 text-xs text-muted shadow-sm"
          role="status"
        >
          View saved
        </span>
      ) : null}
    </div>
  );
}
