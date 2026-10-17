"use client";

import type { Map as MapLibreMap } from "maplibre-gl";
import { cubicBezier, useReducedMotion } from "motion/react";
import { useEffect, useLayoutEffect, useRef } from "react";

import type { Place } from "@/lib/repositories/types";
import {
  CARD_MOTION_EASE,
  CARD_MOTION_SECONDS,
  CARD_PIN_GAP,
  PIN_RADIUS,
} from "./card-motion";

/** Which side the card is held on while the camera moves — see `useMapAnchor`. */
export type HeldCardSide = "left" | "right" | "keep" | null;

/** Breathing room between a pin and the frame's left edge, as `useMapAnchor` keeps. */
const MARGIN = 8;

/**
 * The editor toolbar's row along the top of the frame: `top-2` plus a 44px
 * panel. Not measured, because the toolbar belongs to the editor and this
 * canvas does not know it is there; the only canvas that turns this hook on is
 * the editor's.
 */
const TOP_CLEARANCE = 52;

const ease = cubicBezier(...CARD_MOTION_EASE);

/**
 * On a phone, the camera answers a place card opening and closing.
 *
 * A card beside its pin is 256px or more of a ~360px map, so opened on a pin
 * anywhere but the far left it hung half off the frame. Opening one now eases
 * the map until the pin *and* its card sit centred together, card on the right;
 * closing one eases that pin back to the middle, where the eye already is.
 *
 * **One clock with the card.** The ease uses the card's duration and curve
 * (card-motion.ts), and starts in a layout effect — the same commit the card
 * mounts or begins its exit in — so the two animations are one movement. The
 * card rides along because `useMapAnchor` re-places it on every `move` frame;
 * the exiting card keeps following its pin for the same reason (`PlaceCard`).
 *
 * **The side is held for the length of the ease.** `useMapAnchor` picks the
 * card's side from the room left before the frame's edge, and a pin travelling
 * across the frame crosses that line — a card flipping sides mid-slide is
 * exactly the jump this is here to remove. Opening holds it on the right,
 * which is where the centred pair puts it; closing holds whatever it was.
 *
 * It watches the *selection*, not whether a card is drawn: entering add mode
 * hides the card without anybody closing it, and the map must not move then.
 */
export function useCardCentering({
  map,
  isReady,
  isEnabled,
  selectedPlaceId,
  places,
  cardWidth,
  heldSideRef,
}: {
  map: React.RefObject<MapLibreMap | null>;
  isReady: boolean;
  /** A phone, a canvas showing place cards, and no tool armed. */
  isEnabled: boolean;
  selectedPlaceId: string | null;
  places: readonly Place[];
  /** The card's designed width, which the centring has to make room for. */
  cardWidth: number;
  heldSideRef: React.RefObject<HeldCardSide>;
}) {
  const prefersReducedMotion = useReducedMotion();
  const previous = useRef(selectedPlaceId);
  const placesRef = useRef(places);

  useEffect(() => {
    placesRef.current = places;
  });

  useLayoutEffect(() => {
    const from = previous.current;
    previous.current = selectedPlaceId;

    if (from === selectedPlaceId) return;

    const instance = map.current;
    if (!instance || !isReady || !isEnabled) return;

    const isOpening = selectedPlaceId !== null;

    /*
     * Closing yields to a camera already in flight. Picking a row in the
     * Locations sheet clears the selection *and* flies to a different pin in
     * one gesture, and easing back to the old one would cancel that flight.
     */
    if (!isOpening && instance.isMoving()) return;

    const id = selectedPlaceId ?? from;
    const place = placesRef.current.find((candidate) => candidate.id === id);
    if (!place) return;

    const frame = instance.getContainer();
    const width = frame.clientWidth;

    /*
     * Where the pin lands, as an offset from the frame's centre. Opening puts
     * it left of centre by half of what sits to its right — the gap and the
     * card, less the half of the pin on its left — so the pair is centred. A
     * card nearly as wide as the screen cannot be; the pin then stops at the
     * margin, and the card's far edge is what gives.
     */
    const pinX = isOpening
      ? Math.max(
          MARGIN + PIN_RADIUS,
          width / 2 - (CARD_PIN_GAP + cardWidth - PIN_RADIUS) / 2,
        )
      : width / 2;

    // Centred between the toolbar and the sheet's strip, not on the frame.
    const bottom = cssPixels(frame, "--map-chrome-inset");
    const offsetY = (TOP_CLEARANCE - bottom) / 2;

    heldSideRef.current = isOpening ? "right" : "keep";

    const release = () => {
      heldSideRef.current = null;
    };

    instance.once("moveend", release);
    instance.easeTo({
      center: [place.lng, place.lat],
      offset: [Math.round(pinX - width / 2), Math.round(offsetY)],
      duration: prefersReducedMotion ? 0 : CARD_MOTION_SECONDS * 1000,
      easing: ease,
      essential: true,
    });
  }, [map, isReady, isEnabled, selectedPlaceId, cardWidth, heldSideRef, prefersReducedMotion]);
}

/**
 * A length-valued custom property, in pixels. Inherited values arrive resolved
 * (`4rem`, not `var(--sheet-peek)`); `rem` is the only unit anything here sets
 * besides `px`, and an unset property is zero.
 */
function cssPixels(element: HTMLElement, property: string): number {
  const value = getComputedStyle(element).getPropertyValue(property).trim();
  const amount = Number.parseFloat(value);
  if (!Number.isFinite(amount)) return 0;

  if (value.endsWith("rem")) {
    return amount * Number.parseFloat(getComputedStyle(document.documentElement).fontSize);
  }

  return amount;
}
