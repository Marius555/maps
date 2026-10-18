"use client";

import { inView, useReducedMotion } from "motion/react";
import { useCallback, useEffect, useRef, useState } from "react";

import {
  HERO_PINS,
  HERO_TOUR,
  HERO_YOU_ARE_HERE,
  matchesFilter,
  nearestPin,
  type HeroFilter,
  type HeroPin,
  unprojectPin,
} from "@/lib/marketing/hero-map";

import { useHeroTour } from "./use-hero-tour";

/** A pin the visitor dropped by pressing the ground. */
export type DroppedPin = { id: number; lng: number; lat: number };

/** How many dropped pins the map keeps: enough to play with, never a carpet. */
const MAX_DROPPED = 3;

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
 * **"Drop a pin" arms one placement**: the next press on the ground drops a
 * pin there, opens its card and disarms, the editor's add-location gesture.
 * Otherwise the ground closes cards, as it always did — a map that dropped a
 * pin on every click filled up with pins nobody meant (owner, 2026-10-18). A
 * dropped pin's card stands in for a pinned card until a real pin is pressed;
 * the hover rule above still wins over it. The last `MAX_DROPPED` are kept; dropped pins answer no
 * filter and are never "nearest", because they are the visitor's, not the
 * demo chain's.
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
  const [dropped, setDropped] = useState<DroppedPin[]>([]);
  const [droppedOpenId, setDroppedOpenId] = useState<number | null>(null);
  const [placing, setPlacing] = useState(false);
  const nextDropId = useRef(0);

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

  // Stable, because hero-map.tsx binds Escape with it while placing.
  const cancelPlacing = useCallback(() => setPlacing(false), []);

  const openDropped = hoverName
    ? null
    : (dropped.find((pin) => pin.id === droppedOpenId) ?? null);

  const openName =
    hoverName ??
    (openDropped
      ? null
      : (pinnedName ?? (!pointing && !engaged ? tourName : null)));

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
    dropped,
    openDropped,
    placing,
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
      setDroppedOpenId(null);
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
      setDroppedOpenId(null);
    },

    pressGround() {
      setEngaged(true);
      setPinnedName(null);
      setHoverName(null);
      setDroppedOpenId(null);
    },

    togglePlacing() {
      setEngaged(true);
      setPlacing((current) => !current);
    },

    cancelPlacing,

    /**
     * `point` is where the ground was pressed, as percentages of the picture.
     * Only while "Drop a pin" is armed, and it disarms: one press, one pin.
     */
    dropAt(point: { x: number; y: number }) {
      if (!placing) return;

      const id = nextDropId.current++;
      setPlacing(false);

      setEngaged(true);
      setPinnedName(null);
      setHoverName(null);
      setDropped((current) =>
        [...current, { id, ...unprojectPin(point) }].slice(-MAX_DROPPED),
      );
      setDroppedOpenId(id);
    },

    /* Pressing a dropped pin opens its card, and pressing it again closes it. */
    pressDropped(pin: DroppedPin) {
      setEngaged(true);
      setDroppedOpenId((current) => (current === pin.id ? null : pin.id));
    },

    setPointing,
  };
}
