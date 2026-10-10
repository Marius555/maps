"use client";

import type { AnimationSequence } from "motion/react";

import { ART_PIN } from "@/components/marketing/art/art-pin";
import { ArtStreets } from "@/components/marketing/art/art-streets";
import { useArtLoop } from "@/components/marketing/steps/art/use-art-loop";

import { ArtCursor, cursorTo, PRESS } from "../../art/art-cursor";
import { ArtDropPin, dropPins, liftPins } from "../../art/art-drop-pin";
import { ArtWindow } from "../../art/art-window";

const W = 360;
const H = 240;

const WINDOW = { x: 20, y: 16, width: 320, height: 208 } as const;
const LEFT = { x: 36, y: 56, width: 112, height: 148 } as const;
const COLUMN = { x: 160, y: 56, width: 164, height: 148 } as const;
const COLUMN_MID = { x: COLUMN.x + COLUMN.width / 2, y: COLUMN.y + COLUMN.height / 2 } as const;

/** The shortcode, as Settings → Pinglide hands it out. */
const PILL = { x: 40, y: 178, width: 112, height: 20 } as const;
const REST = { x: PILL.x + 24, y: PILL.y + 10 } as const;

const PINS = [
  { id: "a", x: 186, y: 84 },
  { id: "b", x: 292, y: 92 },
  { id: "c", x: 206, y: 170 },
  { id: "d", x: 300, y: 176 },
] as const;
const MAIN = { id: "main", x: 248, y: 130 } as const;
const ALL = [...PINS.map((pin) => pin.id), MAIN.id];

const EASE = [0.4, 0, 0.2, 1] as const;
/** The pill travels with the cursor: same offset, so it is held, not chased. */
const toColumn = cursorTo(REST, { x: COLUMN_MID.x - 30, y: COLUMN_MID.y });

/**
 * Three beats: the builder's column empties, the shortcode is dragged into it,
 * and the map renders there with its pins dropping in.
 */
const SEQUENCE: AnimationSequence = [
  ...liftPins(ALL, 0),
  ['[data-art="map"]', { opacity: 0 }, { duration: 0.35, at: 0.15 }],

  // Pick up the shortcode and carry it over.
  // `scale` is held at 0.9 from the loop's start, harmless: the pill is hidden.
  ['[data-art="pill"]', { opacity: 1, scale: [0.9, 1] }, { duration: 0.25, at: 0.55 }],
  ['[data-art="cursor"]', PRESS, { duration: 0.3, at: 0.75 }],
  ['[data-art="cursor"]', toColumn, { duration: 0.9, ease: EASE, at: 1.0 }],
  ['[data-art="pill"]', toColumn, { duration: 0.9, ease: EASE, at: 1.0 }],
  ['[data-art="target"]', { opacity: 1 }, { duration: 0.2, at: 1.6 }],

  // Drop it; the map renders.
  ['[data-art="cursor"]', PRESS, { duration: 0.3, at: 1.95 }],
  ['[data-art="pill"]', { opacity: 0, scale: 0.8 }, { duration: 0.25, at: 2.05 }],
  ['[data-art="target"]', { opacity: 0 }, { duration: 0.25, at: 2.1 }],
  ['[data-art="map"]', { opacity: 1 }, { duration: 0.35, at: 2.2 }],
  ['[data-art="pill"]', { x: 0, y: 0, scale: 1 }, { duration: 0.01, at: 2.4 }],
  ...dropPins(ALL, 2.4),
  ['[data-art="cursor"]', { x: 0, y: 0 }, { duration: 0.8, ease: EASE, at: 3.0 }],
];

/** A page builder's two columns: text in one, the map dropped into the other. */
export function ShortcodeArt() {
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
        <clipPath id="wp-shortcode-map">
          <rect {...COLUMN} rx="8" />
        </clipPath>
      </defs>

      <ArtWindow {...WINDOW} dots />

      {/* The left column: a heading, a paragraph, an image. */}
      <rect x={LEFT.x} y={LEFT.y + 2} width="84" height="8" rx="4" fill="var(--foreground)" opacity="0.5" />
      <rect x={LEFT.x} y={LEFT.y + 18} width="104" height="4.5" rx="2.25" fill="var(--muted)" opacity="0.45" />
      <rect x={LEFT.x} y={LEFT.y + 27} width="92" height="4.5" rx="2.25" fill="var(--muted)" opacity="0.45" />
      <rect x={LEFT.x} y={LEFT.y + 36} width="98" height="4.5" rx="2.25" fill="var(--muted)" opacity="0.45" />
      <rect x={LEFT.x} y={LEFT.y + 50} width={LEFT.width - 4} height="58" rx="6" fill="var(--foreground)" opacity="0.06" />

      {/* The right column: an empty builder slot under the map. */}
      <rect
        x={COLUMN.x + 0.5}
        y={COLUMN.y + 0.5}
        width={COLUMN.width - 1}
        height={COLUMN.height - 1}
        rx="8"
        fill="var(--foreground)"
        fillOpacity="0.03"
        stroke="var(--muted)"
        strokeOpacity="0.55"
        strokeDasharray="4 3"
      />
      <rect
        data-art="target"
        x={COLUMN.x + 1}
        y={COLUMN.y + 1}
        width={COLUMN.width - 2}
        height={COLUMN.height - 2}
        rx="7.5"
        fill={ART_PIN.accent}
        fillOpacity="0.08"
        stroke={ART_PIN.accent}
        strokeWidth="1.5"
        opacity="0"
      />

      <g data-art="map">
        <rect {...COLUMN} rx="8" fill="var(--surface)" />
        <rect {...COLUMN} rx="8" fill="var(--foreground)" opacity="0.04" />
        <g clipPath="url(#wp-shortcode-map)">
          <ArtStreets {...COLUMN} />
        </g>
      </g>
      {PINS.map((pin) => (
        <ArtDropPin key={pin.id} {...pin} />
      ))}
      <ArtDropPin {...MAIN} color={ART_PIN.accent} r={7} halo />

      {/* The shortcode. Hidden in the finished frame. */}
      <g data-art="pill" opacity="0">
        <rect {...PILL} rx={PILL.height / 2} fill="var(--foreground)" />
        <text x={PILL.x + PILL.width / 2} y={PILL.y + 13.5} textAnchor="middle" className="font-mono" fontSize="8" fill="var(--background)">
          [pinglide slot=&quot;…&quot;]
        </text>
      </g>

      <ArtCursor {...REST} />
    </svg>
  );
}
