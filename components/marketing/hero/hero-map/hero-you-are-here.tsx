"use client";

import { motion, useReducedMotion } from "motion/react";

import {
  HERO_YOU_ARE_HERE,
  pinInFrame,
  projectPin,
  type FrameSize,
} from "@/lib/marketing/hero-map";

/**
 * "Nearest to me", the visitor's half: the dot saying where they are.
 *
 * Above the pins, on the frame. The way to the nearest pin is `HeroRoute`,
 * which is drawn inside the picture instead, under the pins — see there for
 * why the two cannot share a layer.
 *
 * The ring pulses only where motion is allowed; the dot is the static form.
 */
export function HeroYouAreHere({ frame }: { frame: FrameSize }) {
  const reduced = useReducedMotion();
  const you = pinInFrame(projectPin(HERO_YOU_ARE_HERE), frame);

  return (
    <motion.div
      aria-hidden="true"
      className="pointer-events-none absolute inset-0 z-[1]"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.2 }}
    >
      <span className="mk-hero-you" style={{ left: you.x, top: you.y }}>
        {reduced ? null : (
          <motion.span
            className="mk-hero-you__ring"
            animate={{ scale: [1, 2.8], opacity: [0.45, 0] }}
            transition={{ duration: 1.6, repeat: Infinity, ease: "easeOut" }}
          />
        )}
        <span className="mk-hero-you__dot" />
      </span>
    </motion.div>
  );
}
