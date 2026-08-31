"use client";

import { Button } from "@heroui/react";
import { RefreshCw, TriangleAlert } from "lucide-react";

import type { Place } from "@/lib/repositories/types";
import type { LineRoute } from "@/packages/shared/shapes";
import { RouteStopsList } from "./route-stops-list";

/**
 * The route half of a shape's card: its stops, whether it still describes them,
 * and the one control that fixes it.
 *
 * The distance and the drive are not repeated here — the card's header already
 * prints them through `shapeSummary`, from one function, so that the sidebar row
 * and the card cannot describe one route differently.
 *
 * **Recalculate is a button and not an effect.** Dragging a bonded pin marks the
 * route stale; it does not reroute. Rerouting is the one thing in this feature
 * that reaches a metered service, and firing it from a drag would put an
 * upstream request behind an ordinary gesture — the shape of the cost that
 * CLAUDE.md §2 exists to keep out of the product. Once a route is published it
 * makes no request at all, however many people load the map.
 *
 * **No engine credit here, deliberately, and it is not an oversight to fix.** A
 * line naming OSRM used to sit under this, and it was removed on request.
 * OpenStreetMap attribution is untouched and non-negotiable (§12) — it is
 * rendered on every map by the tile source's own TileJSON, which nothing in this
 * feature goes near. What went is the credit for the *routing engine*, which is
 * what the public OSRM demo server's usage policy asks for; see
 * docs/self-hosting-routing.md, which is where that debt is now recorded.
 */
export function RouteSummary({
  route,
  places,
  isStale,
  isRecalculating,
  onFocusStop,
  onRemoveStop,
  onRecalculate,
}: {
  route: LineRoute;
  places: readonly Place[];
  /** A bonded stop has moved far enough that the drawn path no longer reaches it. */
  isStale: boolean;
  isRecalculating: boolean;
  /** Move the map to one stop. Omitted where the map is not the caller's. */
  onFocusStop?: (index: number) => void;
  /** Drop one stop and reroute through the rest. Same omission as below. */
  onRemoveStop?: (index: number) => void;
  /** Omitted where there is nothing to recalculate with — the preview screens. */
  onRecalculate?: () => void;
}) {
  return (
    <div className="flex flex-col gap-2 px-3 pt-2">
      <RouteStopsList
        stops={route.stops}
        places={places}
        onFocusStop={onFocusStop}
        onRemoveStop={onRemoveStop}
      />

      {isStale ? (
        <p className="flex items-start gap-1.5 text-xs text-warning">
          <TriangleAlert aria-hidden="true" className="mt-px size-3.5 shrink-0" />
          <span>
            A stop has moved. The route still follows the old roads until you
            work it out again.
          </span>
        </p>
      ) : null}

      {/*
       * Recalculate appears only when there is something to recalculate.
       *
       * Asking the engine again for stops that have not moved returns the
       * geometry already on the map, so the button was offering a metered
       * request in exchange for nothing (§2) — and, worse, standing there
       * permanently it read as a route that always needs attention. It now
       * belongs to the warning above it: the message says what went wrong and
       * the button is the one thing that fixes it, which is why they share a
       * condition rather than each having their own.
       *
       * `isRecalculating` is in the condition as well, so a press does not pull
       * the button out from under the pointer. `onUpdateShape` lands the new
       * geometry before the request settles, which clears `isStale` while the
       * spinner is still turning.
       */}
      {onRecalculate && (isStale || isRecalculating) ? (
        <Button
          fullWidth
          size="sm"
          variant="primary"
          isPending={isRecalculating}
          onPress={onRecalculate}
        >
          <RefreshCw aria-hidden="true" className="size-3.5" />
          Recalculate
        </Button>
      ) : null}
    </div>
  );
}
