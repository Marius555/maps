"use client";

import type { DroppedPin } from "./use-hero-map";

import { heroPinPosition } from "./hero-pin-marker";

/**
 * A pin the visitor dropped by clicking the ground.
 *
 * The editor's plain marker with no colour of its own, which is what a new,
 * untagged location looks like on `/maps/[id]` — the accent. It drops and
 * ripples with the landing pins' own CSS (`.mk-hero-pin__drop`), at no delay,
 * and that CSS already stands still under reduced motion.
 */
export function HeroDroppedPin({
  pin,
  selected,
  onPress,
}: {
  pin: DroppedPin;
  selected: boolean;
  onPress: (pin: DroppedPin) => void;
}) {
  return (
    <span
      className="mk-hero-pin"
      style={{ ...heroPinPosition(pin), zIndex: selected ? 2 : undefined }}
      onClick={() => onPress(pin)}
    >
      <span
        aria-hidden="true"
        className={`map-pin mk-hero-pin__drop ${selected ? "map-pin--selected" : ""}`}
      >
        <span className="map-pin__dot" />
        <span className="map-pin__pulse" />
      </span>
    </span>
  );
}
