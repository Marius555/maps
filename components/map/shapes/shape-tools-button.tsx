"use client";

import { Button, Popover, Separator } from "@heroui/react";
import { Circle, Pentagon, Route, Shapes, Slash, Upload } from "lucide-react";
import { useId, useState } from "react";

import { PlanLimitNote, PlanNote } from "@/components/map/plan-limit-note";
import { isAtLimit, type PlanHeadroom } from "@/lib/map/plan-headroom";
import type { ShapeKind } from "@/packages/shared/shapes";

/**
 * The drawing tools, in one control beside Add location.
 *
 * A menu rather than a button each on the toolbar. The panel is deliberately not
 * wrapping (see map-toolbar.tsx) and the search already competes for its width —
 * three more permanent buttons would push a phone's toolbar well past the point
 * where the address field is usable. A menu also matches how the tools behave:
 * you pick one, and it stays picked until you are done drawing with it.
 *
 * While a tool is armed the control is a stop button, not a menu. That is
 * `AddLocationButton`'s idiom, arbitrated in the same place and for the same
 * reason: the button already says "Stop drawing", and opening a menu on top of
 * that would be offering a choice the user has just made.
 *
 * No drag-to-draw source here, unlike the add control. A pin has one position and
 * can be carried to it; a circle has a centre *and* a radius, and a polygon has as
 * many points as it takes — neither is a thing you can drop.
 *
 * At the plan's shape limit every row goes grey — the four tools and Import
 * alike, because all five end in a shape row the server would refuse. The button
 * still opens, for the reason AddLocationButton spells out: the sentence saying
 * why is inside the menu, and a control that will not open cannot deliver it.
 *
 * Greying rather than the omission this menu uses elsewhere. Route and Import
 * *disappear* when their callback is absent, which says "not a thing here"; a
 * tool stopped by the limit is a thing here that works again after a delete, and
 * a row that vanished would be one the user goes looking for.
 *
 * `routesNote` is the third state that distinction earns: Route is a thing here
 * that works again after an *upgrade*, so it greys with its own sentence rather
 * than vanishing. Hiding a paid feature from the plan below it is how nobody
 * finds out it exists.
 */
export function ShapeToolsButton({
  drawMode,
  isRouting,
  isBusy,
  headroom,
  routesNote,
  onPickTool,
  onPickRoute,
  onStopDrawing,
  onImport,
}: {
  /** The armed tool, or null in browse mode. */
  drawMode: ShapeKind | null;
  /**
   * Whether the route tool is armed. Separate from `drawMode` because a route is
   * not a `ShapeKind` — it saves as a line, and folding it in would arm the plain
   * line tool alongside it.
   */
  isRouting?: boolean;
  isBusy: boolean;
  /**
   * The shape allowance. Omitted where there is no plan to check against —
   * nothing greys, which is what every caller got before this existed.
   */
  headroom?: PlanHeadroom;
  /**
   * Why the route tool is off, when the plan does not include it. Absent means
   * it is included — this is the sentence, not a flag, because the component
   * that renders it should not also be deciding how to word it.
   */
  routesNote?: string;
  onPickTool: (kind: ShapeKind) => void;
  /** Arms the route tool. Omitted where there is no map to route on. */
  onPickRoute?: () => void;
  onStopDrawing: () => void;
  /** Opens the GeoJSON import dialog. Omitted where there is nowhere to put it. */
  onImport?: () => void;
}) {
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const isDrawing = drawMode !== null || Boolean(isRouting);

  /*
   * A tool already armed is never switched off by this.
   *
   * Reaching the limit while a polygon is half drawn must not take the tool out
   * from under the gesture — that discards work the user is in the middle of, to
   * prevent a save that the server will refuse anyway with a sentence attached.
   * The menu is not even reachable mid-draw: the button is a stop button while
   * `isDrawing`, so this only ever decides what an *unarmed* menu offers.
   */
  const isFull = headroom ? isAtLimit(headroom) : false;
  const noteId = useId();
  const routeNoteId = useId();

  /*
   * The limit wins when both apply. Two amber lines under one short menu is more
   * reading than the situation deserves, and the shape ceiling is the one that
   * stops every row rather than only this one.
   */
  const isRouteLocked = Boolean(routesNote) && !isFull;

  return (
    <Popover.Root
      isOpen={isMenuOpen}
      onOpenChange={(open) => {
        // While a tool is armed the button stops it rather than reopening the
        // menu — the same arbiter the add control uses.
        if (open && isDrawing) {
          onStopDrawing();
          return;
        }

        setIsMenuOpen(open);
      }}
    >
      <Button
        size="sm"
        variant={isDrawing ? "primary" : "tertiary"}
        aria-pressed={isDrawing}
        isPending={isBusy}
      >
        <Shapes aria-hidden="true" className="size-4" />

        {/*
         * Folds away when the search opens, exactly as the add control's label
         * does and for the same reason: the two cannot both have the width on a
         * narrow map. The text stays in the DOM so the button keeps its
         * accessible name, and `max-width` is what animates cleanly from an
         * auto-sized flex child. The negative margin cancels the Button's `gap-2`,
         * which would otherwise leave a gap where the label used to be.
         */}
        
      </Button>

      <Popover.Content placement="bottom start">
        <Popover.Dialog aria-label="Choose a drawing tool">
          <div className="flex w-auto flex-col gap-0.5">
            <ToolItem
              icon={Circle}
              label="Circle"
              hint="Drag out from the centre"
              isArmed={drawMode === "circle"}
              isDisabled={isFull}
              describedBy={noteId}
              onPress={() => {
                setIsMenuOpen(false);
                onPickTool("circle");
              }}
            />
            <ToolItem
              icon={Pentagon}
              label="Polygon"
              hint="Click each corner, Enter to finish"
              isArmed={drawMode === "polygon"}
              isDisabled={isFull}
              describedBy={noteId}
              onPress={() => {
                setIsMenuOpen(false);
                onPickTool("polygon");
              }}
            />
            <ToolItem
              icon={Slash}
              label="Line"
              hint="Click each point, Enter to finish"
              isArmed={drawMode === "line"}
              isDisabled={isFull}
              describedBy={noteId}
              onPress={() => {
                setIsMenuOpen(false);
                onPickTool("line");
              }}
            />

            {/* In this menu rather than on the toolbar, for the reason at the
                top of this file: the panel does not wrap, and a fourth permanent
                button is the one that pushes the address field off a phone. A
                route also belongs here on the merits — it makes a shape, and it
                is drawn with the same gesture as the line above it. */}
            {onPickRoute ? (
              <ToolItem
                icon={Route}
                label="Route"
                hint="Click each location, Enter to follow the roads"
                isArmed={Boolean(isRouting)}
                isDisabled={isFull || isRouteLocked}
                describedBy={isRouteLocked ? routeNoteId : noteId}
                onPress={() => {
                  setIsMenuOpen(false);
                  onPickRoute();
                }}
              />
            ) : null}

            {/* Below a rule, because it is the odd one out: the three above arm
                a gesture and this one opens a dialog. Still in this menu rather
                than on the toolbar — it makes shapes, and that is what this
                control is for. */}
            {onImport ? (
              <>
                <Separator className="my-1" />
                <ToolItem
                  icon={Upload}
                  label="Import shapes"
                  hint="GeoJSON, TopoJSON or ArcGIS JSON"
                  isDisabled={isFull}
                  describedBy={noteId}
                  onPress={() => {
                    setIsMenuOpen(false);
                    onImport();
                  }}
                />
              </>
            ) : null}

            {/* Under the rule and under every row it explains. The import
                dialog says the same thing again in its own words once open,
                which is not a duplicate: that one counts a *file* against the
                headroom, and this one is why the dialog cannot be opened. */}
            {isFull && headroom ? (
              <div className="max-w-64 px-2 pt-1.5">
                <PlanLimitNote id={noteId} resource="shapes" headroom={headroom} />
              </div>
            ) : null}

            {isRouteLocked && routesNote ? (
              <div className="max-w-64 px-2 pt-1.5">
                <PlanNote id={routeNoteId}>{routesNote}</PlanNote>
              </div>
            ) : null}
          </div>
        </Popover.Dialog>
      </Popover.Content>
    </Popover.Root>
  );
}

/**
 * One tool.
 *
 * A plain `<button>` rather than a HeroUI one, matching `NavCell` in the pin
 * grid: these are rows in a menu, not buttons on a surface, and the variants a
 * Button brings would have to be undone to make them read as a list.
 *
 * The hint is the whole gesture in five words. A drawing tool that does not say
 * how it is used is a tool people press once and abandon, and there is no other
 * moment to say it — the hint bar only appears after the tool is armed.
 *
 * `isArmed` is optional because not every row is a toggle. Import opens a dialog
 * and is never "on", and `aria-pressed="false"` on it would tell a screen reader
 * it is a switch that happens to be off.
 *
 * `aria-disabled` rather than the native attribute, matching PinTile: a disabled
 * button leaves the tab order, and the sentence under these rows is the reason
 * they are off — hiding it from anyone arriving by keyboard is the one outcome
 * greying a control has to avoid.
 */
function ToolItem({
  icon: Icon,
  label,
  hint,
  isArmed,
  isDisabled,
  describedBy,
  onPress,
}: {
  icon: typeof Circle;
  label: string;
  hint: string;
  isArmed?: boolean;
  isDisabled?: boolean;
  /** The note saying why this row is off — announced after its label. */
  describedBy?: string;
  onPress: () => void;
}) {
  return (
    <button
      type="button"
      aria-pressed={isArmed}
      aria-disabled={isDisabled}
      aria-describedby={isDisabled ? describedBy : undefined}
      onClick={isDisabled ? undefined : onPress}
      /* The hover and the armed fill are omitted when disabled rather than
         overridden. Two utilities setting one property are ordered by Tailwind's
         output, not by this string — see pickedTileClass, which settles the same
         question for the pin tiles. */
      className={`flex items-center gap-3 rounded-lg p-2 text-start transition-colors duration-[var(--duration-fast)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--focus)] ${
        isDisabled
          ? "cursor-not-allowed bg-default/40"
          : `cursor-pointer hover:bg-default ${isArmed ? "bg-default" : ""}`
      }`}
    >
      <span
        aria-hidden="true"
        className={`flex size-9 shrink-0 items-center justify-center rounded-full border border-dashed ${
          isDisabled ? "border-border/60 text-muted/50" : "border-border text-muted"
        }`}
      >
        <Icon className="size-4" />
      </span>

      <span className="min-w-0">
        <span
          className={`block text-sm font-medium ${
            isDisabled ? "text-muted" : "text-foreground"
          }`}
        >
          {label}
        </span>
        <span
          className={`block truncate text-xs ${
            isDisabled ? "text-muted/60" : "text-muted"
          }`}
        >
          {hint}
        </span>
      </span>
    </button>
  );
}
