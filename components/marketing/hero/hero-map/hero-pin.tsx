"use client";

import { motion } from "motion/react";

import type { HeroPin as HeroPinData } from "@/lib/marketing/hero-map";

import { HeroPinMarker, heroPinPosition } from "./hero-pin-marker";

/**
 * A pin on the hero map that answers the pointer.
 *
 * A mouse resting on it opens its card and moving off closes it again; a press
 * opens it for good and ends the tour. A pin the filter leaves out shrinks away
 * rather than blinking out, so the chips read as sorting the map rather than
 * repainting it.
 *
 * `initial={false}` is load-bearing: the server renders the pin at rest, and
 * nothing Motion starts from can ship it invisible (see reveal.tsx). The landing
 * animation lives on the marker inside, in CSS, so the two transforms never
 * write to the same element.
 *
 * Out of the tab order on purpose. Thirty-eight stops between the hero's buttons
 * and the rest of the page would be a trap, and a keyboard reaches everything
 * the pins show through the chips and "Nearest to me".
 */
export function HeroPin({
  pin,
  dropRank,
  visible,
  selected,
  onHover,
  onLeave,
  onPress,
}: {
  pin: HeroPinData;
  dropRank: number;
  visible: boolean;
  selected: boolean;
  onHover: (pin: HeroPinData) => void;
  onLeave: (pin: HeroPinData) => void;
  onPress: (pin: HeroPinData) => void;
}) {
  return (
    <motion.span
      className="mk-hero-pin"
      data-hidden={visible ? undefined : ""}
      style={{ ...heroPinPosition(pin), zIndex: selected ? 2 : undefined }}
      initial={false}
      animate={visible ? { scale: 1, opacity: 1 } : { scale: 0.3, opacity: 0 }}
      transition={{
        scale: { type: "spring", stiffness: 420, damping: 26 },
        opacity: { duration: 0.18 },
      }}
      onPointerEnter={(event) => {
        if (event.pointerType === "mouse" && visible) onHover(pin);
      }}
      onPointerLeave={(event) => {
        if (event.pointerType === "mouse") onLeave(pin);
      }}
      onClick={() => {
        if (visible) onPress(pin);
      }}
    >
      <HeroPinMarker pin={pin} selected={selected} dropRank={dropRank} />
    </motion.span>
  );
}
