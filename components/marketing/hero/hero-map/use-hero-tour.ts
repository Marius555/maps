"use client";

import { useEffect, useEffectEvent, useRef } from "react";

import { HERO_TOUR } from "@/lib/marketing/hero-map";

/** Long enough to read a card, short enough that the map is visibly alive. */
const STEP_MS = 3600;

/**
 * Walks the card through `HERO_TOUR` while `running`.
 *
 * The caller decides when that is — in view, nobody pointing at the map, nobody
 * having pressed anything yet, and motion allowed — so this only keeps time. It
 * resumes from where it stopped rather than from the first stop, so a visitor
 * who moves the mouse across the map and away does not see the same card twice.
 */
export function useHeroTour({
  running,
  onStep,
}: {
  running: boolean;
  onStep: (name: string) => void;
}) {
  const index = useRef(0);
  const step = useEffectEvent(onStep);

  useEffect(() => {
    if (!running) return;

    const timer = setInterval(() => {
      index.current = (index.current + 1) % HERO_TOUR.length;
      step(HERO_TOUR[index.current]);
    }, STEP_MS);

    return () => clearInterval(timer);
  }, [running]);
}
