"use client";

import { Separator } from "@heroui/react";
import { Bookmark, Eye } from "lucide-react";
import { AnimatePresence, motion } from "motion/react";
import type { ReactNode } from "react";

import { IconButton } from "@/components/ui/icon-button";
import type { ExportOptions } from "@/lib/export/export-map";
import type { PlanHeadroom } from "@/lib/map/plan-headroom";
import type { MapStyleKey } from "@/lib/map/style";
import type { MapAppearanceSettings } from "@/lib/validation/map-appearance.schema";
import type { CustomPinIcon } from "@/packages/shared/pin-icons";
import type { ShapeKind } from "@/packages/shared/shapes";
import { AddLocationButton } from "./add-location/add-location-button";
import { AppearanceButton } from "./appearance-button";
import { ExportButton } from "./export-button";
import { SelectToolButton } from "./select-tool-button";
import { ShapeToolsButton } from "./shapes/shape-tools-button";

/**
 * Map controls, in a floating panel.
 *
 * They used to be bare buttons sitting on the tiles — `tertiary` variant, which
 * is nearly transparent, so over a light basemap they were close to invisible.
 * Grouping them on a real surface gives them a background to sit on and reads as
 * one control cluster rather than several loose objects.
 *
 * Add mode carries a text label because it is a mode you can be *in*, and an icon
 * alone can't say "currently on". The rest are icon buttons with tooltips. The
 * label folds away while the search is open, because the two cannot both have the
 * width: what says the mode is still on then is the filled button and its pressed
 * state, and the text stays in the DOM so the accessible name never changes.
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
  addIcon,
  recentIcons,
  pinIcons,
  isBusy,
  isDrawingBusy,
  drawMode,
  isRouting,
  isSelecting,
  isSavingView,
  hasSavedView,
  style,
  appearance,
  limits,
  routesNote,
  search,
  onPickIcon,
  onStopAdding,
  onPickTool,
  onPickRoute,
  onStopDrawing,
  onImportShapes,
  onStartSelecting,
  onStopSelecting,
  onDropPin,
  onDraggingChange,
  onOpenStudio,
  onSaveView,
  onPreview,
  onChangeStyle,
  onChangeAppearance,
  exportControl,
}: {
  isAdding: boolean;
  /** The icon add mode is armed with — see AddLocationButton. */
  addIcon: string;
  /** The pins that earn a place on page one — see lib/map/recent-pins.ts. */
  recentIcons: string[];
  /** The map's own pins — see packages/shared/pin-icons.ts. */
  pinIcons: CustomPinIcon[];
  isBusy: boolean;
  /** A shape is mid-save. Separate from `isBusy` so one spinner means one thing. */
  isDrawingBusy: boolean;
  /** The armed drawing tool, or null — see components/map/shapes. */
  drawMode: ShapeKind | null;
  /** The route tool is armed — see components/map/routes. */
  isRouting?: boolean;
  /** The marquee is armed — see components/map/select-box. */
  isSelecting: boolean;
  isSavingView: boolean;
  /** Shows confirmation after a save, so the button's effect is visible. */
  hasSavedView: boolean;
  /** The chosen basemap or theme — see lib/map/style.ts. */
  style: MapStyleKey;
  /** Labels and layer toggles, normalised. */
  appearance: MapAppearanceSettings;
  /**
   * What the plan still has room for, so the controls that spend it can say so
   * before they are used rather than after.
   *
   * One object rather than four scalars, following `exportControl` below: these
   * numbers are only ever read together, and a component that takes `placeLimit`
   * and `placeCount` separately is one refactor away from being handed a count
   * and somebody else's limit. Optional throughout — absent, nothing greys,
   * which is exactly what this toolbar did before.
   */
  limits?: {
    places: PlanHeadroom;
    shapes: PlanHeadroom;
  };
  /**
   * Why the route tool is off, when the plan does not include it. Passed
   * through to the Draw menu, which is the only thing that renders it.
   */
  routesNote?: string;
  search?: ReactNode;
  onPickIcon: (icon: string) => void;
  onStopAdding: () => void;
  onPickTool: (kind: ShapeKind) => void;
  /** Arms the route tool, from inside the Draw menu. */
  onPickRoute?: () => void;
  onStopDrawing: () => void;
  /** Opens the GeoJSON importer, from inside the Draw menu. */
  onImportShapes?: () => void;
  onStartSelecting: () => void;
  onStopSelecting: () => void;
  /** A pin dragged out of the add control and dropped, in viewport coordinates. */
  onDropPin: (clientX: number, clientY: number, icon: string) => void;
  onDraggingChange?: (isDragging: boolean) => void;
  /** Opens the pin studio — a modal on a desktop, a bottom sheet on a phone. */
  onOpenStudio: () => void;
  onSaveView: () => void;
  onPreview: () => void;
  /** Both save immediately — see AppearanceButton. */
  onChangeStyle: (style: MapStyleKey) => void;
  onChangeAppearance: (appearance: MapAppearanceSettings) => void;
  /**
   * Everything the export popover needs, handed over whole.
   *
   * Passed as one object rather than as six props for the same reason `search`
   * is a slot: rendering an image is a job with its own pending state, its own
   * failure and its own remembered choices, and this file stays a toolbar. Absent
   * on a canvas that has no map to photograph.
   */
  exportControl?: {
    options: ExportOptions;
    view: { width: number; height: number };
    isBusy: boolean;
    error: string | null;
    onChange: (options: ExportOptions) => void;
    onExport: () => void;
    onOpen: () => void;
  };
}) {
  return (
    /*
     * The full width of the map, with nothing reserved on the right.
     *
     * This carried a `pr-12` for as long as MapLibre's NavigationControl sat at
     * top-right inside the same box. The controls are in the bottom-right corner
     * now (use-maplibre.ts), so the reservation was a 48px hole the toolbar
     * wrapped around for no reason.
     */
    <div className="pointer-events-none absolute inset-x-2 top-2 z-10 flex flex-wrap items-start gap-2">
      {/*
       * `group/toolbar` is what the add control's label watches: the search sets
       * `data-search-open` on itself when it expands, and the label folds.
       *
       * Deliberately not `flex-wrap`. When the search opens, this panel's width
       * changes over 150ms, and a wrapping row answers "too wide" by breaking
       * onto a second line — a discrete jump, mid-transition, that snaps back
       * when the label finishes folding. A narrow map shrinks the field instead;
       * that is continuous, and every button keeps its size.
       */}
      <div className="group/toolbar pointer-events-auto flex max-w-full min-w-0 items-center gap-1 rounded-xl border border-border bg-surface p-1 shadow-sm">
        <AddLocationButton
          isAdding={isAdding}
          addIcon={addIcon}
          recentIcons={recentIcons}
          pinIcons={pinIcons}
          isBusy={isBusy}
          headroom={limits?.places}
          onPickIcon={onPickIcon}
          onStopAdding={onStopAdding}
          onDropPin={onDropPin}
          onDraggingChange={onDraggingChange}
          onOpenStudio={onOpenStudio}
        />

        {/* Directly beside the pin control, with no rule between them: adding a
            location and drawing an area are the two things you put *on* a map,
            and the rule separates those from the things you do *to* it. */}
        <ShapeToolsButton
          drawMode={drawMode}
          isRouting={isRouting}
          isBusy={isDrawingBusy}
          headroom={limits?.shapes}
          routesNote={routesNote}
          onPickTool={onPickTool}
          onPickRoute={onPickRoute}
          onStopDrawing={onStopDrawing}
          onImport={onImportShapes}
        />

        {/* Third of the three tools that change what a gesture on the map means,
            so it belongs on this side of the rule with the other two. It picks
            out what is already there rather than putting something new down,
            which is why it is the one without a label. */}
        <SelectToolButton
          isSelecting={isSelecting}
          onStartSelecting={onStartSelecting}
          onStopSelecting={onStopSelecting}
        />

        <Separator orientation="vertical" className="h-6" />

        {/* First on this side of the rule, because it is the one that changes
            what the map *is* rather than where it is pointed or who is looking. */}
        <AppearanceButton
          style={style}
          appearance={appearance}
          onChangeStyle={onChangeStyle}
          onChangeAppearance={onChangeAppearance}
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

        {/* The editor canvas has no popups, clusters or filters — those are the
            embed's. This is the only place in the editor you can see them. */}
        <IconButton
          label="Preview as a visitor"
          icon={Eye}
          placement="bottom"
          onPress={onPreview}
        />

        {/* After Preview, and last of the three: both of those show you the map,
            and this is the one that takes it away with you. */}
        {exportControl ? <ExportButton {...exportControl} /> : null}

        {/* Last, so opening the search grows the panel into empty map rather than
            shoving the other controls sideways. The rule goes on a phone, where
            the five pixels it costs are five the address field does not get. */}
        <Separator orientation="vertical" className="h-6 max-sm:hidden" />

        {search}
      </div>

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
