"use client";

import { useEffect, useSyncExternalStore } from "react";

import {
  getOrigin,
  subscribeOrigin,
  warmOrigin,
} from "@/lib/geolocation/directions-origin";
import type { Fix } from "@/packages/shared/position";

/**
 * Where a Directions link on this card should start, once anything knows.
 *
 * Read from one store every card shares (lib/geolocation/directions-origin.ts),
 * so a card already open re-renders with the new `href` the moment a position
 * lands — the press that raised the permission prompt is what earns every
 * press after it a real start point, on the card the owner is still looking at.
 *
 * `enabled` is false on the designer canvas, which draws Directions as a span
 * that goes nowhere: no warm-up there, so arranging a card never starts a
 * geolocation watch. The value is still read, because a hook cannot be called
 * conditionally — it is simply unused.
 *
 * The server snapshot is `null`, which is the link a card has always had, so
 * hydration agrees and the origin arrives on the client's next render.
 */
export function useDirectionsOrigin(enabled: boolean): Fix | null {
  const origin = useSyncExternalStore(subscribeOrigin, getOrigin, noOrigin);

  useEffect(() => {
    if (enabled) warmOrigin();
  }, [enabled]);

  return origin;
}

function noOrigin(): null {
  return null;
}
