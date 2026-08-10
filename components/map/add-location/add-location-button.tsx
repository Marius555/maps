"use client";

import { Button } from "@heroui/react";
import { MapPin } from "lucide-react";
import { useEffect } from "react";

import { useDragToAdd } from "./use-drag-to-add";

/**
 * Two ways to add a location, one control.
 *
 * Drag the pin onto the map and let go, and it lands where you dropped it —
 * which is the gesture people already know from every other map they use, and it
 * says where the pin is going before it goes there.
 *
 * Click instead of dragging and it arms the older sticky add mode: the cursor
 * becomes a crosshair and every click on the map drops a pin until Esc. That
 * path stays because dragging is a pointer gesture and a map builder has to be
 * usable from the keyboard (§8) — and because dropping forty pins in a row is
 * genuinely faster when you are not dragging each one out of the toolbar.
 *
 * The two cannot both fire from one press, hence `consumeDidDrag`: React Aria
 * raises `onPress` on pointer-up regardless of how far the pointer travelled, so
 * without it every drag would also toggle add mode on the way out.
 */
export function AddLocationButton({
  isAdding,
  isBusy,
  isDisabled,
  onToggleAdd,
  onDropPin,
  onDraggingChange,
}: {
  isAdding: boolean;
  isBusy: boolean;
  /** At the plan's place limit — the control stays visible, and inert. */
  isDisabled?: boolean;
  onToggleAdd: () => void;
  onDropPin: (clientX: number, clientY: number) => void;
  /** Lets the map say what to do with the pin now in the air. */
  onDraggingChange?: (isDragging: boolean) => void;
}) {
  const { isDragging, handleProps, consumeDidDrag } = useDragToAdd({
    onDrop: onDropPin,
    isDisabled,
  });

  // Twice a gesture, not per pointer sample — the position never comes through
  // here, only whether a drag is happening at all.
  useEffect(() => {
    onDraggingChange?.(isDragging);
  }, [isDragging, onDraggingChange]);

  return (
    /*
     * The pointer listeners sit on a wrapper rather than on the Button. React
     * Aria owns the Button's own pointer handling, and adding a second set of
     * handlers to the same element is how the two end up fighting over which of
     * them saw the press.
     *
     * The pin that follows the pointer is not rendered here: it is a plain DOM
     * node the hook appends to the body for the length of the gesture, because
     * it moves with every pointer sample and React does not need to know.
     */
    <span {...handleProps} className="inline-flex">
      <Button
        size="sm"
        variant={isAdding ? "primary" : "tertiary"}
        aria-pressed={isAdding}
        isPending={isBusy}
        isDisabled={isDisabled}
        className={isDragging ? "cursor-grabbing" : "cursor-grab"}
        onPress={() => {
          if (consumeDidDrag()) return;
          onToggleAdd();
        }}
      >
        {/* Faded, not hidden: the icon is in the air, and what stays behind reads
            as the socket it came out of rather than as a second pin. */}
        <MapPin
          aria-hidden="true"
          className={`size-4 transition-opacity duration-[var(--duration-fast)] ease-[var(--ease-out-fluid)] ${
            isDragging ? "opacity-30" : "opacity-100"
          }`}
        />

        {/*
         * The label folds away while a pin is being dragged, so the control
         * becomes the icon that is now travelling. It comes back on release; a
         * plain click never collapses it, which is what keeps "Stop adding"
         * readable for anyone using the sticky add mode instead of the gesture.
         *
         * `max-width`, not `width` — it animates reliably from an auto-sized flex
         * child, the same idiom the nav sidebar's labels use. The text stays in
         * the DOM throughout, so the button keeps its accessible name.
         *
         * The negative margin cancels the Button's own `gap-2`. Without it the
         * label reaches zero width and leaves half a centimetre of nothing behind,
         * and the button stops short of closing up.
         */}
        <span
          className={`overflow-hidden whitespace-nowrap transition-[max-width,opacity,margin] duration-[var(--duration-fast)] ease-[var(--ease-out-fluid)] ${
            isDragging ? "-ms-2 max-w-0 opacity-0" : "ms-0 max-w-40 opacity-100"
          }`}
        >
          {isAdding ? "Stop adding" : "Add location"}
        </span>
      </Button>
    </span>
  );
}
