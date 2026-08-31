"use client";

import { Button, Popover, Separator } from "@heroui/react";
import { Circle, Pentagon, Route, Shapes, Slash, Upload } from "lucide-react";
import { useState } from "react";

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
 */
export function ShapeToolsButton({
  drawMode,
  isRouting,
  isBusy,
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
  onPickTool: (kind: ShapeKind) => void;
  /** Arms the route tool. Omitted where there is no map to route on. */
  onPickRoute?: () => void;
  onStopDrawing: () => void;
  /** Opens the GeoJSON import dialog. Omitted where there is nowhere to put it. */
  onImport?: () => void;
}) {
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const isDrawing = drawMode !== null || Boolean(isRouting);

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
        <span className="overflow-hidden whitespace-nowrap transition-[max-width,opacity,margin] duration-[var(--duration-fast)] ease-[var(--ease-out-fluid)] ms-0 max-w-40 opacity-100 group-has-[[data-search-open]]/toolbar:-ms-2 group-has-[[data-search-open]]/toolbar:max-w-0 group-has-[[data-search-open]]/toolbar:opacity-0">
          {isDrawing ? "Stop drawing" : "Draw"}
        </span>
      </Button>

      <Popover.Content placement="bottom start">
        <Popover.Dialog aria-label="Choose a drawing tool">
          <div className="flex w-auto flex-col gap-0.5">
            <ToolItem
              icon={Circle}
              label="Circle"
              hint="Drag out from the centre"
              isArmed={drawMode === "circle"}
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
                  onPress={() => {
                    setIsMenuOpen(false);
                    onImport();
                  }}
                />
              </>
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
 */
function ToolItem({
  icon: Icon,
  label,
  hint,
  isArmed,
  onPress,
}: {
  icon: typeof Circle;
  label: string;
  hint: string;
  isArmed?: boolean;
  onPress: () => void;
}) {
  return (
    <button
      type="button"
      aria-pressed={isArmed}
      onClick={onPress}
      className={`flex cursor-pointer items-center gap-3 rounded-lg p-2 text-start transition-colors duration-[var(--duration-fast)] hover:bg-default focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--focus)] ${
        isArmed ? "bg-default" : ""
      }`}
    >
      <span
        aria-hidden="true"
        className="flex size-9 shrink-0 items-center justify-center rounded-full border border-dashed border-border text-muted"
      >
        <Icon className="size-4" />
      </span>

      <span className="min-w-0">
        <span className="block text-sm font-medium text-foreground">{label}</span>
        <span className="block truncate text-xs text-muted">{hint}</span>
      </span>
    </button>
  );
}
