"use client";

import { animate, motion, useMotionValue, useReducedMotion } from "motion/react";
import { useEffect } from "react";

import { DotField } from "./dot-field";
import { MapFrame } from "./map-frame";
import { MapLegend } from "./map-legend";
import { TILT_PINS, TILT_VIEW } from "./tilt-data";
import { PLANE_TILT, TiltPin } from "./tilt-pin";
import { TiltRoute } from "./tilt-route";

/** How far the plane swings either way, and how long one swing takes. */
const SWING_DEG = 7;
const SWING_S = 16;

/** Pins land north to south, then the road starts drawing. */
const DROP_START_S = 0.35;
const DROP_STEP_S = 0.07;

const ORDERED = [...TILT_PINS].sort((a, b) => a.top - b.top);
const DROP_DELAY = new Map(ORDERED.map((pin, i) => [pin.name, DROP_START_S + i * DROP_STEP_S]));
const ROUTE_DELAY = DROP_START_S + ORDERED.length * DROP_STEP_S + 0.2;

/**
 * The landing page's map: Europe laid on a table, seen in perspective, slowly turning.
 *
 * Not the world, and not flat: a dotted Europe tilted away from the viewer,
 * swinging gently either way, with the editor's own pins standing up off it
 * and a road drawing itself from Lisbon to Berlin. The plane and the pins are
 * real CSS 3D — `.mk-tilt-plane` in globals.css keeps the pins in its space.
 */
export default function EuropeMap() {
  const still = useReducedMotion() ?? false;
  const spin = useMotionValue(still ? -3 : -SWING_DEG);

  useEffect(() => {
    if (still) return;
    const controls = animate(spin, [-SWING_DEG, SWING_DEG], {
      duration: SWING_S,
      ease: "easeInOut",
      repeat: Infinity,
      repeatType: "mirror",
    });
    return () => controls.stop();
  }, [spin, still]);

  return (
    <MapFrame label={`A tilted map of Europe with ${TILT_PINS.length} coffee shops and a route between seven of them`}>
      {/* The fade-in is on the scene, never the plane: opacity below 1 on a
          preserve-3d box flattens it, and the pins would lie down mid-fade. */}
      <motion.div
        className="mk-tilt-scene absolute inset-0"
        initial={still ? false : { opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.6 }}
      >
        <motion.div
          className="mk-tilt-plane"
          style={{
            aspectRatio: `${TILT_VIEW.width} / ${TILT_VIEW.height}`,
            rotateX: PLANE_TILT,
            rotate: spin,
          }}
          initial={still ? false : { scale: 0.88 }}
          animate={{ scale: 1 }}
          transition={{ duration: 1.1, ease: [0.22, 1, 0.36, 1] }}
        >
          <svg viewBox={`0 0 ${TILT_VIEW.width} ${TILT_VIEW.height}`} className="absolute inset-0 size-full overflow-visible">
            <defs>
              <radialGradient id="mk-tilt-fade" cx="50%" cy="50%" r="55%">
                <stop offset="60%" stopColor="#fff" />
                <stop offset="100%" stopColor="#fff" stopOpacity={0} />
              </radialGradient>
              <mask id="mk-tilt-mask">
                <rect width={TILT_VIEW.width} height={TILT_VIEW.height} fill="url(#mk-tilt-fade)" />
              </mask>
              <filter id="mk-tilt-blur" x="-50%" y="-50%" width="200%" height="200%">
                <feGaussianBlur stdDeviation="3" />
              </filter>
            </defs>

            <g mask="url(#mk-tilt-mask)">
              <DotField grid="europe" view={TILT_VIEW} radius={2.3} className="text-foreground/30" />
            </g>

            {/* Each pin's shadow on the ground, arriving as the pin lands. */}
            {TILT_PINS.map((pin) => (
              <motion.ellipse
                key={pin.name}
                cx={pin.x}
                cy={pin.y}
                rx={9}
                ry={9}
                className="fill-foreground"
                filter="url(#mk-tilt-blur)"
                initial={still ? false : { opacity: 0, scale: 0.2 }}
                animate={{ opacity: 0.22, scale: 1 }}
                transition={{ duration: 0.5, delay: (DROP_DELAY.get(pin.name) ?? 0) + 0.15 }}
              />
            ))}

            <TiltRoute delay={ROUTE_DELAY} still={still} />
          </svg>

          {TILT_PINS.map((pin) => (
            <TiltPin
              key={pin.name}
              pin={pin}
              spin={spin}
              delay={DROP_DELAY.get(pin.name) ?? 0}
              still={still}
            />
          ))}
        </motion.div>
      </motion.div>

      {/* The far edge fades into haze, so the plane has a horizon, not a cut. */}
      <div className="mk-tilt-haze pointer-events-none absolute inset-x-0 top-0 h-1/3" />

      <div className="pointer-events-none absolute inset-x-3 top-3 z-20 flex justify-between gap-2">
        <MapLegend />
      </div>
    </MapFrame>
  );
}
