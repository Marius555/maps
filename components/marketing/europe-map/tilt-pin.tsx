"use client";

import { motion, useTransform, type MotionValue } from "motion/react";

import { HeroPinMarker } from "@/components/marketing/hero/hero-map/hero-pin-marker";

import type { TiltPin as TiltPinData } from "./tilt-data";

/** The plane's tilt, in degrees. The pins turn back by exactly this. */
export const PLANE_TILT = 56;

/**
 * One of the editor's pins, standing up off the tilted plane.
 *
 * The wrapper sits on the pin's spot on the plane and turns back by the
 * plane's own tilt and spin — `rotate` before `rotateX` in Motion's order, the
 * exact inverse of the plane's `rotateX` then `rotate` — so the marker faces
 * the viewer square while perspective still makes the far ones smaller. It
 * drops in from above on a spring and rides a short stem, which is what makes
 * it read as standing rather than painted on.
 */
export function TiltPin({
  pin,
  spin,
  delay,
  still,
}: {
  pin: TiltPinData;
  spin: MotionValue<number>;
  delay: number;
  still: boolean;
}) {
  const unspin = useTransform(spin, (v) => -v);
  const flagship = pin.kind === "flagship";
  const stem = flagship ? 30 : 20;

  return (
    <motion.div
      className="absolute size-0"
      style={{
        left: `${pin.left}%`,
        top: `${pin.top}%`,
        rotate: unspin,
        rotateX: -PLANE_TILT,
        transformOrigin: "0 0",
      }}
    >
      <motion.div
        className="absolute bottom-0 left-0 flex flex-col items-center"
        style={{ translateX: "-50%" }}
        initial={still ? false : { y: -90, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{
          y: { type: "spring", stiffness: 260, damping: 17, delay },
          opacity: { duration: 0.2, delay },
        }}
      >
        {flagship ? (
          <span className="map-chrome-panel mb-0.5 rounded-full px-2 py-0.5 text-[11px] font-semibold whitespace-nowrap shadow-sm">
            {pin.name}
          </span>
        ) : null}
        <HeroPinMarker pin={{ ...pin, street: "" }} />
        <span
          aria-hidden="true"
          className="-mt-3.5 w-0.5 rounded-full bg-foreground/35"
          style={{ height: stem }}
        />
      </motion.div>
    </motion.div>
  );
}
