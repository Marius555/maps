"use client";

import { AnimatePresence } from "motion/react";
import { useState } from "react";

import {
  HERO_PINS,
  HERO_YOU_ARE_HERE,
  dropRanks,
} from "@/lib/marketing/hero-map";
import { heroRouteTo } from "@/lib/marketing/hero-routes";
import { distanceKm } from "@/packages/shared/geo";

import { HeroAttribution } from "./hero-attribution";
import { HeroFilters } from "./hero-filters";
import { HeroNearMe } from "./hero-near-me";
import { HeroPin } from "./hero-pin";
import { HeroPlaceCard } from "./hero-place-card";
import { HeroRoute } from "./hero-route";
import { HeroYouAreHere } from "./hero-you-are-here";
import { useElementSize } from "./use-element-size";
import { useHeroMap } from "./use-hero-map";

const DROP_RANKS = dropRanks(HERO_PINS);

/**
 * The hero's map: a picture of a basemap with the editor's pins on it, and a
 * few of the embed's own moves played over it.
 *
 * **Still no MapLibre.** It was the live embed once, and a store locator
 * squeezed into a hero arrived with its search panel, its toolbar and two
 * toggles under it — a busy screenshot rather than a map. The ground is the
 * editor's basemap rendered once and committed as an image (Positron on the
 * light site, Carbon on the dark one — see `.mk-hero-map__stage` in
 * globals.css). What moves is four things a visitor to a customer's site
 * actually gets, and nothing else: the pins landing, a card on a pin, the tag
 * chips, and "Nearest to me".
 *
 * The server renders the picture and every pin at rest, so the page reads with
 * no script at all; the card and the "you are here" layer are placed in frame
 * pixels and exist only once the frame has been measured.
 */
export function HeroMap() {
  const [frame, setFrame] = useState<HTMLDivElement | null>(null);
  const size = useElementSize(frame);
  const map = useHeroMap(frame);

  /*
   * The card gets the route's own distance and drive time for the pin the route
   * actually ends at, and the straight-line distance for any other pin hovered
   * while the layer is on — which is all there is to say about a pin nothing was
   * measured to.
   */
  const route =
    map.nearMe && map.openPin?.name === map.nearest?.name
      ? heroRouteTo(map.openPin?.name)
      : null;

  const km =
    map.nearMe && map.openPin && !route
      ? distanceKm(HERO_YOU_ARE_HERE, map.openPin)
      : null;

  return (
    <div
      ref={setFrame}
      className="mk-hero-map relative overflow-hidden rounded-2xl border border-border bg-surface-secondary shadow-sm"
      onPointerEnter={(event) => {
        if (event.pointerType === "mouse") map.setPointing(true);
      }}
      onPointerLeave={(event) => {
        if (event.pointerType === "mouse") map.setPointing(false);
      }}
    >
      {/* The frame's rectangle, as a container the stage can be sized against in
          both axes — see `.mk-hero-map__viewport` in globals.css for why the
          frame itself cannot be that container. */}
      <div className="mk-hero-map__viewport">
        <div
          role="img"
          aria-label={`A map of London with ${HERO_PINS.length} coffee shops pinned on it`}
          className="mk-hero-map__stage"
          onClick={(event) => {
            // The ground itself, not a pin on it.
            if (event.target === event.currentTarget) map.pressGround();
          }}
        >
          {/* Before the pins, so every one of them paints over it and the
              route ends under its pin rather than across it. */}
          <AnimatePresence>
            {map.nearMe && map.nearest && size ? (
              <HeroRoute key="route" frame={size} target={map.nearest} />
            ) : null}
          </AnimatePresence>

          {HERO_PINS.map((pin, index) => (
            <HeroPin
              key={pin.name}
              pin={pin}
              dropRank={DROP_RANKS[index]}
              visible={map.isShown(pin)}
              selected={map.openPin?.name === pin.name}
              onHover={map.hoverPin}
              onLeave={map.leavePin}
              onPress={map.pressPin}
            />
          ))}
        </div>
      </div>

      <AnimatePresence>
        {map.nearMe && size ? (
          <HeroYouAreHere key="you" frame={size} />
        ) : null}
      </AnimatePresence>

      <AnimatePresence>
        {map.openPin && size ? (
          <HeroPlaceCard
            key="card"
            pin={map.openPin}
            km={km}
            route={route}
            frame={size}
          />
        ) : null}
      </AnimatePresence>

      <div className="absolute inset-x-3 top-3 z-20 flex items-start justify-between gap-2">
        <HeroFilters
          value={map.filter}
          count={map.shownCount}
          onChange={map.setFilter}
        />
        <HeroNearMe active={map.nearMe} onToggle={map.toggleNearMe} />
      </div>

      <HeroAttribution />
    </div>
  );
}
