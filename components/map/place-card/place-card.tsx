"use client";

import type { Map as MapLibreMap } from "maplibre-gl";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { useEffect } from "react";

import { CardView } from "@/components/card/card-view";
import type { MapCategory, MapField, Place } from "@/lib/repositories/types";
import type { CardLayout } from "@/packages/shared/card-layout";
import type { CustomPinIcon } from "@/packages/shared/pin-icons";
import { useMapAnchor } from "../use-map-anchor";
import { PlaceCardChrome } from "./place-card-chrome";

/** The gap that keeps the card off the pin, added to the card's own width. */
const FLIP_GAP = 22;

/**
 * What a location with nothing on it says for itself.
 *
 * Editor-only, passed rather than built into `CardView`, because it asks the
 * reader to go and edit the location — which a visitor to a customer's site can
 * neither do nor be told to do. The embed passes nothing and shows nothing.
 *
 * It sits between the card's blocks and its chrome, so the Edit button
 * immediately below it is the action the sentence is asking for (CLAUDE.md §8:
 * an empty state is an invitation, with the primary action right there).
 */
function renderEmptyState() {
  return (
    <p className="px-[var(--card-pad)] pb-[var(--card-pad)] text-xs text-muted">
      No details yet. Add an address, description or contact details.
    </p>
  );
}

/**
 * Everything a location holds, beside its pin.
 *
 * Positioned by projecting the place's coordinates rather than through MapLibre's
 * `Popup`: a popup takes an HTML string or a detached DOM node, so React content
 * would have to be rendered into a portal inside a node the map owns and torn
 * down by hand. This is a plain absolutely-positioned element that follows the
 * map (see use-map-anchor.ts) and never leaves React's tree.
 *
 * Three nested elements, each with one job, because they cannot share a
 * `transform`: the anchor is moved per frame by the hook, the positioner holds
 * the static offset from the pin, and Motion owns the third for its animation.
 * Collapsing any two would have one of them overwriting another sixty times a
 * second.
 */
export function PlaceCard({
  map,
  isReady,
  place,
  category,
  layout,
  fields,
  pinIcons,
  onClose,
  onEdit,
}: {
  map: React.RefObject<MapLibreMap | null>;
  isReady: boolean;
  place: Place | null;
  category: MapCategory | undefined;
  /**
   * The card the owner designed, which the embed's popup draws from too.
   *
   * One layout, two renderers: what they arrange here is what a visitor gets,
   * which is the point of designing it in the dashboard at all.
   */
  layout: CardLayout;
  fields: MapField[];
  /** The map's pins, for a card whose layout holds a Logo block. */
  pinIcons: CustomPinIcon[];
  onClose: () => void;
  onEdit?: (placeId: string) => void;
}) {
  // The card's own width now, not a constant — the owner can make it wider, and
  // the side the card flips to has to be decided from the width it will be.
  const anchor = useMapAnchor(map, isReady, place, layout.width + FLIP_GAP);
  const prefersReducedMotion = useReducedMotion();

  // Escape closes the card. On the window because focus may still be on the pin,
  // on the list row, or nowhere at all.
  useEffect(() => {
    if (!place) return;

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [place, onClose]);

  return (
    <div
      ref={anchor}
      data-flip="right"
      className="map-card-anchor pointer-events-none absolute top-0 left-0 z-20"
    >
      {/* Vertically centred on the pin and to one side of it — the side the hook
          chose, from how much room is left before the frame's edge. Which side
          that is, is CSS: app/globals.css, keyed off the anchor's data-flip.
          Plain CSS rather than a Tailwind group-data variant because the hook
          writes the attribute at 60fps and this must not depend on a variant
          being generated. */}
      <div className="map-card-anchor__card">
        <AnimatePresence>
          {place ? (
            <motion.div
              // Constant, not `place.id` — see ShapeCard for the whole story.
              // Keyed on the id, picking a second location mounts the new card
              // while the old one is still exiting, and the previous location's
              // card ghosts through the new one. The card is one surface that
              // changes subject; the animation marks it opening and closing.
              key="card"
              initial={
                prefersReducedMotion
                  ? { opacity: 0 }
                  : { opacity: 0, scale: 0.94 }
              }
              animate={{ opacity: 1, scale: 1 }}
              exit={
                prefersReducedMotion
                  ? { opacity: 0 }
                  : { opacity: 0, scale: 0.94 }
              }
              transition={{ duration: 0.15, ease: [0, 0, 0.2, 1] }}
              /*
               * Capped against the map frame, not at a fixed 256px.
               *
               * It used to be the latter, and a location with opening hours —
               * seven rows plus a status line — overflowed it, so the common
               * case of filling the form in properly was rewarded with a
               * scrollbar inside a card the size of a business card. The frame
               * is `overflow-hidden`, though, so an uncapped card near the top
               * or bottom edge would be clipped instead. This is the height at
               * which neither happens; the body still scrolls past it, which now
               * takes a genuinely enormous location to reach.
               *
               * The cap itself is a CSS variable the anchor hook writes from the
               * map frame's height (app/globals.css keys `.map-card` off it), for
               * the same reason the flip side is CSS: it changes as the map is
               * resized, and this must not depend on a React render to keep up.
               */
              className="pointer-events-auto"
              role="dialog"
              aria-label={place.name}
            >
              {/* `map-card` carries the height cap the anchor hook writes from
                  the map frame, and the floor beside it, so it belongs on the
                  element that actually is the card — see the note above. */}
              <CardView
                layout={layout}
                place={place}
                category={category}
                fields={fields}
                pinIcons={pinIcons}
                className="map-card relative border border-border"
                renderEmptyState={renderEmptyState}
              >
                <PlaceCardChrome
                  place={place}
                  onClose={onClose}
                  onEdit={onEdit}
                />
              </CardView>
            </motion.div>
          ) : null}
        </AnimatePresence>
      </div>
    </div>
  );
}
