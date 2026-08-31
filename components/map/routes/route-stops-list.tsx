"use client";

import { MapPin, Milestone, X } from "lucide-react";

import { canRemoveStop } from "@/lib/map/route-stops";
import type { Place } from "@/lib/repositories/types";
import type { RouteStop } from "@/packages/shared/shapes";

/**
 * The stops a route was asked for, in order — and the only grip left on one.
 *
 * The route on the map is hundreds of points; these two or five are the only
 * part of it anybody decided. That was always why they are listed. It became
 * load-bearing when the vertex handles came off a routed line: dragging a point
 * of an engine's answer moves the path off the road it snapped to, so there is
 * nothing on the canvas to grab any more and this list is where a route is
 * *changed*, not only read.
 *
 * So a row does two things. Pressing it flies the map to that stop, which is the
 * only way to find the third stop of a route that runs off the screen. Pressing
 * its × drops the stop and asks the engine again for the ones that remain.
 *
 * The × is a sibling of the row's button, never nested inside it — a button
 * inside a button is invalid, and browsers resolve it by dropping one of them.
 *
 * Both are optional, and without them this is exactly the read-only list it used
 * to be. That is what the preview and import-review screens get: they render a
 * map they cannot edit, and the same standing-down `onRecalculate` already does.
 *
 * A stop bonded to a location that has since been deleted keeps its coordinates
 * and says so, rather than vanishing. That is the same dangling-id contract the
 * line's own endpoints have: nothing cleans up after a delete, so every reader
 * has to render the gap honestly.
 */
export function RouteStopsList({
  stops,
  places,
  onFocusStop,
  onRemoveStop,
}: {
  stops: readonly RouteStop[];
  places: readonly Place[];
  /** Move the map to this stop. Omitted where the map is not the caller's. */
  onFocusStop?: (index: number) => void;
  /** Drop this stop and reroute. Omitted on the screens that only display. */
  onRemoveStop?: (index: number) => void;
}) {
  return (
    <ol className="flex flex-col gap-0.5">
      {stops.map((stop, index) => {
        const place = stop.placeId
          ? places.find((candidate) => candidate.id === stop.placeId)
          : undefined;

        const isBonded = Boolean(stop.placeId);
        const Icon = isBonded ? MapPin : Milestone;

        /*
         * Asked per row, because the answer differs between rows of one route.
         * Two stops is the floor, so a two-stop route offers no × at all; and on
         * a round trip A→B→A the middle stop cannot come out either, since what
         * it would leave is a journey from a place to itself. Hidden rather than
         * disabled — see `removeStopAt`, which is the same function this asks.
         */
        const canRemove =
          Boolean(onRemoveStop) && canRemoveStop(stops, index);

        // "Waypoint" is only ever read by a route drawn before stops were
        // required to be locations. Nothing produces one now.
        const label = isBonded
          ? (place?.name ?? "Deleted location")
          : "Waypoint";

        const body = (
          <>
            <span
              aria-hidden="true"
              className="flex size-5 shrink-0 items-center justify-center rounded-full bg-default text-muted"
            >
              <Icon className="size-3" />
            </span>

            <span
              className={`truncate ${
                place || !isBonded ? "text-foreground" : "text-muted italic"
              }`}
            >
              {label}
            </span>
          </>
        );

        return (
          <li
            // Index, deliberately: a stop has no id, and two stops on the same
            // location are genuinely the same value. The order is the identity
            // here, and the list is never reordered in place.
            key={`${index}-${stop.placeId ?? ""}`}
            className="flex items-center gap-1"
          >
            {onFocusStop ? (
              <button
                type="button"
                onClick={() => onFocusStop(index)}
                // min-h-8 rather than the text's own height: this card is 16rem
                // wide and lives on a map people use with a thumb.
                className="flex min-h-8 min-w-0 flex-1 cursor-pointer items-center gap-2 rounded-md px-1 text-start text-xs transition-colors duration-[var(--duration-fast)] hover:bg-surface-secondary focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--focus)]"
              >
                {body}
              </button>
            ) : (
              <span className="flex min-h-8 min-w-0 flex-1 items-center gap-2 px-1 text-xs">
                {body}
              </span>
            )}

            {canRemove ? (
              <button
                type="button"
                aria-label={`Remove ${label} from this route`}
                onClick={() => onRemoveStop?.(index)}
                className="flex size-7 shrink-0 cursor-pointer items-center justify-center rounded-md text-muted transition-colors duration-[var(--duration-fast)] hover:bg-default hover:text-danger focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--focus)]"
              >
                <X aria-hidden="true" className="size-3.5" />
              </button>
            ) : null}
          </li>
        );
      })}
    </ol>
  );
}
