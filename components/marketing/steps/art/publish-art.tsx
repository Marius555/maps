"use client";

import type { AnimationSequence, Segment } from "motion/react";

import { ART_PIN, ART_RAISED, ArtPin } from "../../art/art-pin";
import { ArtStreets } from "../../art/art-streets";
import { useArtLoop } from "./use-art-loop";

const W = 360;
const H = 240;

const WINDOW = { x: 20, y: 16, width: 320, height: 168 } as const;
const MAP = { x: 144, y: 52, width: 182, height: 118 } as const;
const PILL = { x: 40, y: 190, width: 280, height: 36 } as const;

const CHECK = { x: PILL.x + PILL.width - 22, y: PILL.y + PILL.height / 2 } as const;

/** The embedded map's pins, the accent one last — it is the one the card is on. */
const PINS = [
  { x: 176, y: 84 },
  { x: 264, y: 80 },
  { x: 300, y: 128 },
  { x: 184, y: 142 },
  { x: 226, y: 112 },
];
const MAIN = PINS.length - 1;

/** Where the cursor goes to paste: into the map, just past its accent pin. */
const PASTE = { x: MAP.x + 104 - CHECK.x, y: MAP.y + 72 - CHECK.y } as const;

const EASE = [0.4, 0, 0.2, 1] as const;

/**
 * Copy, carry, paste: the cursor presses the pill's check, travels up into the
 * page, the map's pins come alive one after another, and the cursor goes back
 * to where it started — which is where the server drew it.
 */
const SEQUENCE: AnimationSequence = [
  ['[data-art="cursor"]', { scale: [1, 0.82, 1] }, { duration: 0.3, at: 0 }],
  ['[data-art="check-dot"]', { scale: [1, 1.2, 1] }, { duration: 0.35, at: 0.2 }],
  // At the press itself: a drawn check held until 0.3 would vanish on its own a
  // beat before anything touched it (a sequence holds [0, …] from time zero).
  ['[data-art="check"]', { pathLength: [0, 1] }, { duration: 0.4, ease: EASE, at: 0.05 }],
  ['[data-art="cursor"]', { x: PASTE.x, y: PASTE.y }, { duration: 0.8, ease: EASE, at: 1.0 }],
  ['[data-art="cursor"]', { scale: [1, 0.82, 1] }, { duration: 0.3, at: 1.85 }],
  ...PINS.map(
    (_, index): Segment => [
      `[data-ripple="${index}"]`,
      // Starting at rest (invisible) — see RIPPLE in import-art.tsx.
      { opacity: [0, 0.5, 0], scale: [0.5, 0.5, 2.6] },
      { duration: 0.75, ease: "easeOut", times: [0, 0.02, 1], at: 2.0 + index * 0.12 },
    ],
  ),
  ['[data-art="main"]', { scale: [1, 1.3, 1] }, { duration: 0.45, at: 2.55 }],
  ['[data-art="cursor"]', { x: 0, y: 0 }, { duration: 0.8, ease: EASE, at: 3.3 }],
];

/**
 * Step three: somebody's own website with the map in it, and the one line
 * that put it there — the code pill overlaps the window, because it is the
 * thing that went into it.
 */
export function PublishArt() {
  const scope = useArtLoop<SVGSVGElement>(SEQUENCE, 1.4);

  return (
    <svg
      ref={scope}
      aria-hidden="true"
      viewBox={`0 0 ${W} ${H}`}
      className="h-full w-full"
      preserveAspectRatio="xMidYMid meet"
    >
      <defs>
        <clipPath id="publish-window">
          <rect x={WINDOW.x} y={WINDOW.y} width={WINDOW.width} height={WINDOW.height} rx="12" />
        </clipPath>
        <clipPath id="publish-map">
          <rect x={MAP.x} y={MAP.y} width={MAP.width} height={MAP.height} rx="8" />
        </clipPath>
      </defs>

      {/* The browser window: a toolbar band with three dots and an address bar. */}
      <g style={ART_RAISED}>
        <rect
          x={WINDOW.x}
          y={WINDOW.y}
          width={WINDOW.width}
          height={WINDOW.height}
          rx="12"
          fill="var(--surface)"
        />
      </g>
      <g clipPath="url(#publish-window)">
        <rect
          x={WINDOW.x}
          y={WINDOW.y}
          width={WINDOW.width}
          height="26"
          fill="var(--foreground)"
          opacity="0.04"
        />
      </g>
      <g fill="var(--muted)" opacity="0.5">
        <circle cx={WINDOW.x + 16} cy={WINDOW.y + 13} r="3.5" />
        <circle cx={WINDOW.x + 28} cy={WINDOW.y + 13} r="3.5" />
        <circle cx={WINDOW.x + 40} cy={WINDOW.y + 13} r="3.5" />
      </g>
      <rect
        x={WINDOW.x + 62}
        y={WINDOW.y + 7}
        width="180"
        height="12"
        rx="6"
        fill="var(--foreground)"
        opacity="0.06"
      />

      {/* Their page: a heading, a paragraph, a button. */}
      <rect x="36" y="60" width="80" height="8" rx="4" fill="var(--foreground)" opacity="0.5" />
      <rect x="36" y="78" width="92" height="5" rx="2.5" fill="var(--muted)" opacity="0.45" />
      <rect x="36" y="88" width="72" height="5" rx="2.5" fill="var(--muted)" opacity="0.45" />
      <rect x="36" y="102" width="42" height="12" rx="6" fill={ART_PIN.accent} opacity="0.9" />

      {/* Our map, inside it. */}
      <rect
        x={MAP.x}
        y={MAP.y}
        width={MAP.width}
        height={MAP.height}
        rx="8"
        fill="var(--foreground)"
        opacity="0.04"
      />
      <g clipPath="url(#publish-map)">
        <ArtStreets x={MAP.x} y={MAP.y} width={MAP.width} height={MAP.height} />
      </g>

      {PINS.map((pin, index) => (
        <circle
          key={index}
          data-ripple={index}
          cx={pin.x}
          cy={pin.y}
          r="6"
          fill={ART_PIN.accent}
          opacity="0"
        />
      ))}
      {PINS.slice(0, MAIN).map((pin, index) => (
        <ArtPin key={index} x={pin.x} y={pin.y} />
      ))}
      <g data-art="main">
        <ArtPin x={PINS[MAIN].x} y={PINS[MAIN].y} color={ART_PIN.accent} r={7} halo />
      </g>

      {/* The line. Foreground on background, so it is the darkest thing on a
          light page and the lightest on a dark one. */}
      <rect
        x={PILL.x}
        y={PILL.y}
        width={PILL.width}
        height={PILL.height}
        rx={PILL.height / 2}
        fill="var(--foreground)"
      />
      <text
        x={PILL.x + 20}
        y={PILL.y + 22}
        className="font-mono"
        fontSize="11"
        fill="var(--background)"
      >
        {'<script src="…/map.js"></script>'}
      </text>
      <circle data-art="check-dot" cx={CHECK.x} cy={CHECK.y} r="10" fill={ART_PIN.accent} />
      <path
        data-art="check"
        d={`M${CHECK.x - 5} ${CHECK.y + 0.5}l3.5 3.5l6.5-7`}
        fill="none"
        stroke="var(--accent-foreground)"
        strokeWidth="2.2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />

      {/* The cursor, resting on the check. Its position is the outer group's;
          the inner one is what moves, so a transform written by the animation
          never replaces the one that places it. */}
      <g transform={`translate(${CHECK.x + 2} ${CHECK.y + 2})`}>
        <path
          data-art="cursor"
          d="M0 0L0 15L4 11.2L7 18L9.6 16.9L6.7 10.2L12 10.2Z"
          fill="var(--surface)"
          stroke="var(--foreground)"
          strokeWidth="1.2"
          strokeLinejoin="round"
        />
      </g>
    </svg>
  );
}
