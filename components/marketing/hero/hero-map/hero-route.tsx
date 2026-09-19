"use client";

import { motion } from "motion/react";
import { useId } from "react";

import {
  HERO_YOU_ARE_HERE,
  projectPin,
  stageBox,
  type FramePoint,
  type FrameSize,
  type HeroPin,
} from "@/lib/marketing/hero-map";
import { heroRouteTo } from "@/lib/marketing/hero-routes";

/** Centre to centre, in pixels. The dots are round caps on zero-length dashes. */
const DOT_SPACING = 9;
const DOT_SIZE = 4;
const CASING_SIZE = 7;

/**
 * "Nearest to me", drawn: the way from the visitor to the closest pin, as dots.
 *
 * **A road route, not a ruler line.** It used to be `M…L…` between the two
 * points, which said "1.8 km as the crow flies" on a page whose Key section
 * promises a route with a real drive time on it. The geometry is the routing
 * engine's own, measured once and committed (lib/marketing/hero-routes.ts) —
 * pressing the button makes no request, which is CLAUDE.md §2 applied to our
 * own most-visited page. No baked route (editing `HERO_PINS` without
 * regenerating) and the straight line comes back rather than nothing.
 *
 * **Inside the stage, first, so every pin paints over it.** It used to be a
 * layer on the frame at `z-index: 1`, meant to sit under the raised open pin —
 * but `.mk-hero-map__viewport` is a size container, size containment makes it
 * a stacking context of its own, and a pin's `z-index` never left it. The whole
 * picture sat under the layer and the line ran across the pin it was meant to
 * end at. Here it is a sibling of the pins, earlier in the tree, and ends under
 * the pin instead. Its coordinates are the stage's pixels for the same reason.
 *
 * **Dotted, and drawn through a mask.** Motion's `pathLength` *is* a dash
 * array, so it cannot draw a line that already has one: the dots are static and
 * a solid stroke in the mask is what grows, from the visitor outwards. It is
 * keyed by the pin, so a filter that moves "nearest" is seen to redraw it. The
 * casing dots under the accent ones keep it legible where it runs along a road
 * the basemap has already drawn.
 */
export function HeroRoute({
  frame,
  target,
}: {
  frame: FrameSize;
  target: HeroPin;
}) {
  const maskId = useId();
  const stage = stageBox(frame);
  const d = pathTo(target, stage);

  return (
    <motion.svg
      aria-hidden="true"
      className="pointer-events-none absolute inset-0 overflow-visible"
      width={stage.width}
      height={stage.height}
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.2 }}
    >
      {/* userSpaceOnUse: the default region is the path's bounding box plus
          10%, which clips the dots off a route that runs nearly straight. */}
      <mask
        id={maskId}
        maskUnits="userSpaceOnUse"
        x={0}
        y={0}
        width={stage.width}
        height={stage.height}
      >
        <motion.path
          key={target.name}
          d={d}
          fill="none"
          stroke="white"
          strokeWidth={CASING_SIZE * 2}
          strokeLinecap="round"
          strokeLinejoin="round"
          initial={{ pathLength: 0 }}
          animate={{ pathLength: 1 }}
          transition={{ duration: 0.6, ease: [0.2, 0, 0, 1] }}
        />
      </mask>

      <g mask={`url(#${maskId})`}>
        <Dots d={d} stroke="var(--surface)" size={CASING_SIZE} />
        <Dots d={d} stroke="var(--accent)" size={DOT_SIZE} />
      </g>
    </motion.svg>
  );
}

function Dots({ d, stroke, size }: { d: string; stroke: string; size: number }) {
  return (
    <path
      d={d}
      fill="none"
      stroke={stroke}
      strokeWidth={size}
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeDasharray={`0 ${DOT_SPACING}`}
    />
  );
}

/** The whole way there in the stage's pixels, as an SVG path. */
function pathTo(
  target: HeroPin,
  stage: { width: number; height: number },
): string {
  const route = heroRouteTo(target.name);
  const inStage = ({ x, y }: FramePoint): FramePoint => ({
    x: (x / 100) * stage.width,
    y: (y / 100) * stage.height,
  });

  const points = [
    inStage(projectPin(HERO_YOU_ARE_HERE)),
    ...(route?.points ?? []).map(([lng, lat]) => inStage(projectPin({ lng, lat }))),
    inStage(projectPin(target)),
  ];

  return points
    .map((point, index) => `${index === 0 ? "M" : "L"}${round(point.x)} ${round(point.y)}`)
    .join("");
}

/** Sub-pixel precision is bytes in the DOM that no screen can draw. */
function round(value: number): number {
  return Math.round(value * 10) / 10;
}
