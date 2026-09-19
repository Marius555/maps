"use client";

import { inView, useReducedMotion } from "motion/react";
import { useCallback, useEffect, useState } from "react";

import {
  HERO_PINS,
  HERO_TOUR,
  HERO_YOU_ARE_HERE,
  matchesFilter,
  nearestPin,
  type HeroFilter,
  type HeroPin,
} from "@/lib/marketing/hero-map";

import { useHeroTour } from "./use-hero-tour";

/** The first card waits for the pins to land — the drop wave takes about this long. */
const FIRST_CARD_MS = 1600;

function shownBy(filter: HeroFilter): HeroPin[] {
  return HERO_PINS.filter((pin) => matchesFilter(pin, filter));
}

function nearestName(filter: HeroFilter): string | null {
  return nearestPin(HERO_YOU_ARE_HERE, shownBy(filter))?.pin.name ?? null;
}

/**
 * Everything the hero map remembers: the filter, which card is open, whether
 * "Nearest to me" is on, and whether the visitor has taken over from the tour.
 *
 * **Three sources for one card, resolved in one place.** A hovered pin wins,
 * then a pinned one, then the tour — and the tour's card exists only while the
 * pointer is off the map entirely:
 *
 *     hover ?? pinned ?? (pointer off the map and nothing pressed ? tour : none)
 *
 * That ordering is the whole behaviour. It used to be one `openName` written by
 * four different things, which meant a card had no way to *close*: hovering a
 * pin opened one and moving away left it sitting there, and the tour kept
 * moving it while somebody was pointing at the map. Now leaving a pin closes
 * its card, and the tour is a thing the map does when nobody is looking at it
 * closely.
 *
 * **Any press still ends the tour for good.** A pin, the ground, a chip or
 * "Nearest to me" — once somebody has done something the map is theirs, and a
 * card moving on its own would be undoing it. Pointing is not choosing, so a
 * mouse merely crossing the map suppresses the tour's card without ending it.
 *
 * Reduced motion gets the tour's first card, open and still: the static form of
 * "this map has cards on it".
 */
export function useHeroMap(frame: Element | null) {
  const reduced = useReducedMotion() ?? false;
  const [onScreen, setOnScreen] = useState(false);
  const [filter, setFilterState] = useState<HeroFilter>("all");
  const [hoverName, setHoverName] = useState<string | null>(null);
  const [pinnedName, setPinnedName] = useState<string | null>(null);
  const [tourName, setTourName] = useState<string | null>(null);
  const [nearMe, setNearMe] = useState(false);
  const [engaged, setEngaged] = useState(false);
  const [pointing, setPointingState] = useState(false);

  useEffect(() => {
    if (!frame) return;

    return inView(
      frame,
      () => {
        setOnScreen(true);
        return () => setOnScreen(false);
      },
      { amount: 0.3 },
    );
  }, [frame]);

  useEffect(() => {
    if (engaged) return;

    const timer = setTimeout(
      () => setTourName((current) => current ?? HERO_TOUR[0]),
      reduced ? 0 : FIRST_CARD_MS,
    );
    return () => clearTimeout(timer);
  }, [engaged, reduced]);

  useHeroTour({
    running: onScreen && !engaged && !pointing && !reduced,
    onStep: setTourName,
  });

  /* The pointer leaving the frame has to clear the hover as well: a pin's own
     `pointerleave` normally does it, but a pointer that leaves the window from
     directly over a pin does not always send one. */
  const setPointing = useCallback((next: boolean) => {
    setPointingState(next);
    if (!next) setHoverName(null);
  }, []);

  const openName =
    hoverName ?? pinnedName ?? (!pointing && !engaged ? tourName : null);

  // A card on a pin the filter has just hidden closes with it.
  const openPin =
    HERO_PINS.find((pin) => pin.name === openName && matchesFilter(pin, filter)) ??
    null;

  const nearest = nearMe
    ? (HERO_PINS.find((pin) => pin.name === nearestName(filter)) ?? null)
    : null;

  return {
    filter,
    shownCount: shownBy(filter).length,
    openPin,
    nearMe,
    nearest,
    isShown: (pin: HeroPin) => matchesFilter(pin, filter),

    setFilter(next: HeroFilter) {
      setEngaged(true);
      setFilterState(next);
      // "Nearest" is nearest among what is on the map, so it moves with the filter.
      if (nearMe) setPinnedName(nearestName(next));
    },

    toggleNearMe() {
      setEngaged(true);

      if (nearMe) {
        setNearMe(false);
        // The card this opened goes off with it — but not one the visitor has
        // since opened themselves.
        setPinnedName((current) =>
          current === nearestName(filter) ? null : current,
        );
        return;
      }

      setNearMe(true);
      setPinnedName(nearestName(filter));
    },

    hoverPin(pin: HeroPin) {
      setHoverName(pin.name);
    },

    /* Guarded by name: moving between two touching pins fires the new pin's
       `enter` before the old pin's `leave`, and an unguarded clear would close
       the card that had just opened. */
    leavePin(pin: HeroPin) {
      setHoverName((current) => (current === pin.name ? null : current));
    },

    pressPin(pin: HeroPin) {
      setEngaged(true);
      setPinnedName(pin.name);
    },

    pressGround() {
      setEngaged(true);
      setPinnedName(null);
      setHoverName(null);
    },

    setPointing,
  };
}
