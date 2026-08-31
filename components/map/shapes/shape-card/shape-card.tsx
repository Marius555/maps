"use client";

import { Button } from "@heroui/react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { useEffect } from "react";

import { RouteSummary } from "@/components/map/routes/route-summary";
import type { Place, Shape } from "@/lib/repositories/types";
import { routeOf } from "@/packages/shared/shapes";
import { ShapeCardHeader } from "./shape-card-header";

/**
 * A shape's card, docked in the bottom-right corner of the map.
 *
 * Unlike a location's card this is not anchored to a point, and the difference
 * is the shape itself. A pin is 36px wide, so a card beside it covers nothing;
 * an area can be the width of the viewport, and a card anchored to its centre
 * opens *inside* the fill — over the handles, over the thing it is describing.
 * Pushing it clear of the extent only works while there is room to be clear in,
 * which for a shape near the frame's edge, or one bigger than the frame, there
 * is not. Then the clearance gets clamped and the card lands back on top.
 *
 * A corner is the answer, because a shape has no one point worth pointing at.
 * The card stays out of the way of every shape at every zoom, which is what it
 * could never promise while it was tied to the geometry.
 *
 * `bottom-9` rather than `bottom-2`: MapLibre's attribution sits bottom-right in
 * the same box, and OpenStreetMap credit has to stay visible and clickable
 * (§12). It is not decoration that can be covered.
 */
export function ShapeCard({
  shape,
  places,
  isRouteStale,
  isRecalculating,
  onClose,
  onEdit,
  onFocusStop,
  onRemoveStop,
  onRecalculate,
}: {
  shape: Shape | null;
  /** Names for a route's bonded stops. Empty where the caller has no locations. */
  places?: readonly Place[];
  isRouteStale?: boolean;
  isRecalculating?: boolean;
  onClose: () => void;
  onEdit?: (shapeId: string) => void;
  /** Move the map to one of a route's stops. Same omission as `onRecalculate`. */
  onFocusStop?: (index: number) => void;
  /** Drop one of a route's stops and reroute. Same omission as `onRecalculate`. */
  onRemoveStop?: (index: number) => void;
  /** Omitted on the screens that only display a map — preview, import review. */
  onRecalculate?: () => void;
}) {
  const prefersReducedMotion = useReducedMotion();
  const route = shape ? routeOf(shape.geometry) : null;

  // Escape closes the card. On the window because focus may be on a handle, on
  // the sidebar row, or nowhere at all.
  useEffect(() => {
    if (!shape) return;

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [shape, onClose]);

  return (
    <div className="pointer-events-none absolute right-2 bottom-9 z-20 flex max-w-[calc(100%-1rem)] justify-end">
      <AnimatePresence>
        {shape ? (
          <motion.div
            /*
             * Constant, deliberately not `shape.id`.
             *
             * Keyed on the id, picking a second shape reads to AnimatePresence
             * as one child leaving and a different one arriving — and in the
             * default sync mode both are mounted for the whole 150ms exit. The
             * wrapper is a flex row, so the outgoing card still takes layout and
             * shoves the incoming one sideways: the old card visibly flashes
             * before the new one settles.
             *
             * The card is one persistent surface that changes subject, so a
             * stable key is also the honest description of it. Switching becomes
             * a content update; the animation is left to mark the card appearing
             * and disappearing, which is the moment it was feedback for (§8).
             */
            key="card"
            // Rises into the corner rather than scaling out of a point. A card
            // that is not anchored to anything has no point to grow from, and
            // scaling one in a fixed corner reads as a glitch.
            initial={
              prefersReducedMotion ? { opacity: 0 } : { opacity: 0, y: 8 }
            }
            animate={{ opacity: 1, y: 0 }}
            exit={prefersReducedMotion ? { opacity: 0 } : { opacity: 0, y: 8 }}
            transition={{ duration: 0.15, ease: [0, 0, 0.2, 1] }}
            // The height cap is the frame's, minus room for the toolbar above
            // and the attribution below, so a long description scrolls inside
            // the card rather than growing past the map.
            className="pointer-events-auto flex max-h-[min(24rem,calc(100%-1rem))] w-64 max-w-full flex-col overflow-hidden rounded-xl border border-border bg-surface shadow-lg"
            role="dialog"
            aria-label={shape.name}
          >
            <ShapeCardHeader shape={shape} onClose={onClose} />

            {/*
             * One scroller for everything under the header, rather than one per
             * block. A route's stops and a long description are both variable
             * height, and two independent scrollers inside a 24rem card is two
             * places to lose the end of the text.
             */}
            {route || shape.description ? (
              <div className="flex min-h-0 flex-col gap-2 overflow-y-auto pb-3">
                {route ? (
                  <RouteSummary
                    route={route}
                    places={places ?? []}
                    isStale={isRouteStale ?? false}
                    isRecalculating={isRecalculating ?? false}
                    onFocusStop={onFocusStop}
                    onRemoveStop={onRemoveStop}
                    onRecalculate={onRecalculate}
                  />
                ) : null}

                {shape.description ? (
                  <p className="px-3 pt-1 text-sm whitespace-pre-line text-muted">
                    {shape.description}
                  </p>
                ) : null}
              </div>
            ) : (
              // The header's own padding stops at the title, so without this the
              // card would end flush against its last line of text.
              <div className="h-3 shrink-0" />
            )}

            {onEdit ? (
              <div className="shrink-0 border-t border-border p-2">
                <Button
                  size="sm"
                  variant="tertiary"
                  fullWidth
                  onPress={() => onEdit(shape.id)}
                >
                  Edit shape
                </Button>
              </div>
            ) : null}
          </motion.div>
        ) : null}
      </AnimatePresence>
    </div>
  );
}
