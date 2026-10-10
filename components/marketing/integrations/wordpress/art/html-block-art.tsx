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
const CODE = { x: 40, y: 64, width: 280, height: 30 } as const;
const MAP = { x: 40, y: 104, width: 280, height: 104 } as const;
const TYPED = { x: CODE.x + 12, width: CODE.width - 24 } as const;

const PINS = [
  { id: "a", x: 76, y: 132 },
  { id: "b", x: 148, y: 184 },
  { id: "c", x: 226, y: 126 },
  { id: "d", x: 292, y: 176 },
] as const;
const MAIN = { id: "main", x: 190, y: 156 } as const;
const ALL = [...PINS.map((pin) => pin.id), MAIN.id];

const REST = { x: 306, y: 206 } as const;
const EASE = [0.4, 0, 0.2, 1] as const;

/**
 * Three beats: the Custom HTML block empties, the embed line types itself in,
 * and the map renders under it with its pins dropping in.
 */
const SEQUENCE: AnimationSequence = [
  ...liftPins(ALL, 0),
  ['[data-art="map"]', { opacity: 0 }, { duration: 0.35, at: 0.15 }],
  ['[data-art="type"]', { width: 0 }, { duration: 0.25, at: 0.3 }],

  // Click into the block and paste.
  ['[data-art="cursor"]', cursorTo(REST, { x: CODE.x + 14, y: CODE.y + 16 }), { duration: 0.7, ease: EASE, at: 0.6 }],
  ['[data-art="cursor"]', PRESS, { duration: 0.3, at: 1.35 }],
  ['[data-art="type"]', { width: TYPED.width }, { duration: 1.0, ease: "linear", at: 1.5 }],
  ['[data-art="cursor"]', { x: 0, y: 0 }, { duration: 0.8, ease: EASE, at: 1.7 }],

  // The map renders.
  ['[data-art="map"]', { opacity: 1 }, { duration: 0.35, at: 2.6 }],
  ...dropPins(ALL, 2.8),
];

/**
 * An editor with an HTML block holding the embed line, and its preview.
 * `label` is what the block is called: WordPress's "Custom HTML" by default,
 * "Embed" on the any-website page, where it stands for every builder's version.
 */
export function HtmlBlockArt({ label = "Custom HTML" }: { label?: string }) {
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
        <clipPath id="wp-html-type">
          <rect data-art="type" x={TYPED.x} y={CODE.y} width={TYPED.width} height={CODE.height} />
        </clipPath>
        <clipPath id="wp-html-map">
          <rect {...MAP} rx="8" />
        </clipPath>
      </defs>

      <ArtWindow {...WINDOW} bar={30} />
      <circle cx={WINDOW.x + 17} cy={WINDOW.y + 15} r="7" fill="var(--foreground)" opacity="0.7" />
      <rect x={WINDOW.x + 120} y={WINDOW.y + 11} width="80" height="8" rx="4" fill="var(--foreground)" opacity="0.08" />
      <rect x={WINDOW.x + 262} y={WINDOW.y + 8} width="46" height="14" rx="4" fill={ART_PIN.accent} opacity="0.9" />

      {/* The block's label, the way the editor tags a selected block. */}
      <rect x={CODE.x} y={CODE.y - 16} width={label.length * 4.6 + 12} height="13" rx="3" fill="var(--foreground)" opacity="0.08" />
      <text x={CODE.x + 6} y={CODE.y - 6.5} fontSize="8" fontWeight="600" fill="var(--foreground)">
        {label}
      </text>

      {/* The code, dark on light — the darkest thing in the drawing. */}
      <rect {...CODE} rx="8" fill="var(--foreground)" />
      <text
        x={TYPED.x}
        y={CODE.y + 18.5}
        className="font-mono"
        fontSize="8.5"
        fill="var(--background)"
        clipPath="url(#wp-html-type)"
      >
        {'<script type="module" src="…/map.js"></script>'}
      </text>

      <g data-art="map">
        <rect {...MAP} rx="8" fill="var(--surface)" />
        <rect {...MAP} rx="8" fill="var(--foreground)" opacity="0.04" />
        <g clipPath="url(#wp-html-map)">
          <ArtStreets {...MAP} />
        </g>
      </g>
      {PINS.map((pin) => (
        <ArtDropPin key={pin.id} {...pin} />
      ))}
      <ArtDropPin {...MAIN} color={ART_PIN.accent} r={7} halo />

      <ArtCursor {...REST} />
    </svg>
  );
}
