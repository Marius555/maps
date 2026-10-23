"use client";

import { animate, motion, useMotionValue, useTransform } from "motion/react";
import { useEffect, useRef } from "react";

import { TILT_ROUTE_D } from "./tilt-data";

/** One loop: the road draws, a dot drives it, it fades, and again. */
const LOOP_S = 10;

/**
 * The road the tilted map draws, the way the editor's route tool does: a line
 * that draws itself between the stops, then a dot that drives it.
 *
 * One Motion value runs 0…1 per loop and every part reads its own slice of it,
 * so they cannot drift apart. The dot's position comes from the path itself
 * (`getPointAtLength`), so it is on the curve by construction.
 */
export function TiltRoute({ delay, still }: { delay: number; still: boolean }) {
  const path = useRef<SVGPathElement | null>(null);
  const loop = useMotionValue(still ? 0.5 : 0);

  useEffect(() => {
    if (still) return;
    const controls = animate(loop, [0, 1], {
      duration: LOOP_S,
      ease: "linear",
      delay,
      repeat: Infinity,
    });
    return () => controls.stop();
  }, [loop, delay, still]);

  const drawn = useTransform(loop, [0, 0.28], [0, 1], { clamp: true });
  const driven = useTransform(loop, [0.25, 0.85], [0, 1], { clamp: true });
  const fade = useTransform(loop, [0, 0.02, 0.9, 1], [0, 1, 1, 0]);

  const at = (t: number) => {
    const element = path.current;
    if (!element) return { x: 0, y: 0 };
    return element.getPointAtLength(t * element.getTotalLength());
  };
  const carX = useTransform(driven, (t) => at(t).x);
  const carY = useTransform(driven, (t) => at(t).y);
  const carOpacity = useTransform(loop, [0.24, 0.27, 0.85, 0.9], [0, 1, 1, 0]);

  return (
    <motion.g className="text-accent" style={{ opacity: still ? 1 : fade }}>
      {/* A soft bed under the line, so it reads as a road on the ground. */}
      <motion.path
        d={TILT_ROUTE_D}
        fill="none"
        stroke="currentColor"
        strokeWidth={9}
        strokeLinecap="round"
        opacity={0.14}
        style={{ pathLength: still ? 1 : drawn }}
      />
      <motion.path
        ref={path}
        d={TILT_ROUTE_D}
        fill="none"
        stroke="currentColor"
        strokeWidth={3}
        strokeLinecap="round"
        style={{ pathLength: still ? 1 : drawn }}
      />
      {still ? null : (
        <>
          <motion.circle cx={carX} cy={carY} r={11} fill="currentColor" fillOpacity={0.2} style={{ opacity: carOpacity }} />
          <motion.circle cx={carX} cy={carY} r={5.5} className="fill-surface" stroke="currentColor" strokeWidth={3} style={{ opacity: carOpacity }} />
        </>
      )}
    </motion.g>
  );
}
