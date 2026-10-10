"use client";

import type { AnimationSequence } from "motion/react";

import { ArtCard } from "@/components/marketing/art/art-card";
import { ART_PIN } from "@/components/marketing/art/art-pin";
import { ArtStreets } from "@/components/marketing/art/art-streets";
import { useArtLoop } from "@/components/marketing/steps/art/use-art-loop";

import { ArtBlockPlaceholder, setupButton } from "../art/art-block-placeholder";
import { ArtCursor, cursorTo, PRESS } from "../art/art-cursor";
import { ArtDropPin, dropPins, liftPins } from "../art/art-drop-pin";
import { ArtMapPicker, PICKER_ROW, pickerLayout } from "../art/art-map-picker";
import { ArtWindow } from "../art/art-window";

const W = 360;
const H = 240;

const WINDOW = { x: 20, y: 16, width: 320, height: 208 } as const;
const BLOCK = { x: 60, y: 102, width: 240, height: 108 } as const;
const SHEET = { x: 96, y: 40, width: 168, height: 150 } as const;

const SETUP = setupButton(BLOCK.x, BLOCK.y);
const PICKER = pickerLayout(SHEET.x, SHEET.y, SHEET.width, SHEET.height);

const REST = { x: 306, y: 196 } as const;

/** The map's pins, the accent one last: it is the one the card opens on. */
const PINS = [
  { id: "p0", x: 88, y: 126 },
  { id: "p1", x: 272, y: 128 },
  { id: "p2", x: 104, y: 188 },
  { id: "p3", x: 282, y: 192 },
  { id: "p4", x: 232, y: 200 },
] as const;
const MAIN = { id: "main", x: 140, y: 150 } as const;
const ALL = [...PINS.map((pin) => pin.id), MAIN.id];

/** The card, at 0.8 of the landing page's, beside the accent pin. */
const CARD = { x: MAIN.x + 18, y: MAIN.y - 37, scale: 0.8 } as const;

const EASE = [0.4, 0, 0.2, 1] as const;
const move = (to: { x: number; y: number }) => cursorTo(REST, to);

/**
 * Four beats, the whole round trip in one drawing:
 *
 * 1. **The block as inserted.** The finished map clears — card, pins, then the
 *    map — leaving the dashed placeholder.
 * 2. **Set up this map** is pressed.
 * 3. **Choose a map**: our sheet rises over the editor, the cursor picks the
 *    second map and presses Connect, which ticks, and the sheet goes.
 * 4. **The map arrives**: pins drop in one by one, and a press on the accent
 *    pin opens its card — what a visitor will do with it.
 *
 * It ends where the server drew it, so the loop carries straight on and a
 * reader with reduced motion sees the finished page (use-art-loop.ts).
 */
const SEQUENCE: AnimationSequence = [
  // 1. Clear the finished map.
  ['[data-art="card"]', { opacity: 0, scale: 0.85 }, { duration: 0.3, at: 0 }],
  ...liftPins(ALL, 0.15),
  ['[data-art="map"]', { opacity: 0 }, { duration: 0.4, at: 0.3 }],

  // 2. Set up this map.
  ['[data-art="cursor"]', move(SETUP.mid), { duration: 0.8, ease: EASE, at: 0.8 }],
  ['[data-art="cursor"]', PRESS, { duration: 0.3, at: 1.65 }],
  ['[data-art="setup"]', { scale: [1, 0.94, 1] }, { duration: 0.3, at: 1.65 }],

  // 3. Choose a map, Connect.
  ['[data-art="sheet"]', { opacity: 1, y: [12, 0] }, { duration: 0.35, ease: EASE, at: 2.0 }],
  ['[data-art="cursor"]', move(PICKER.rowMid(1)), { duration: 0.5, ease: EASE, at: 2.25 }],
  ['[data-art="cursor"]', PRESS, { duration: 0.3, at: 2.8 }],
  ['[data-art="picker-highlight"]', { y: PICKER_ROW + 4 }, { duration: 0.25, ease: EASE, at: 2.85 }],
  ['[data-art="cursor"]', move(PICKER.connectMid), { duration: 0.45, ease: EASE, at: 3.15 }],
  ['[data-art="cursor"]', PRESS, { duration: 0.3, at: 3.65 }],
  ['[data-art="connect"]', { scale: [1, 0.94, 1] }, { duration: 0.3, at: 3.65 }],
  // Held at 0 from the start of the loop, which is harmless: the sheet is
  // invisible until 2.0.
  ['[data-art="connect-check"]', { pathLength: [0, 1], opacity: [0, 1] }, { duration: 0.3, ease: EASE, at: 3.75 }],
  ['[data-art="sheet"]', { opacity: 0, y: 12 }, { duration: 0.3, ease: EASE, at: 4.2 }],
  ['[data-art="picker-highlight"]', { y: 0 }, { duration: 0.01, at: 4.55 }],

  // 4. The map arrives, and a visitor opens a card.
  ['[data-art="map"]', { opacity: 1 }, { duration: 0.35, at: 4.4 }],
  ...dropPins(ALL, 4.6),
  ['[data-art="cursor"]', move(MAIN), { duration: 0.6, ease: EASE, at: 5.4 }],
  ['[data-art="cursor"]', PRESS, { duration: 0.3, at: 6.05 }],
  ['[data-art="card"]', { opacity: 1, scale: 1 }, { duration: 0.4, ease: "backOut", at: 6.15 }],
  ['[data-art="cursor"]', { x: 0, y: 0 }, { duration: 0.8, ease: EASE, at: 6.75 }],
];

/**
 * The WordPress page's lead drawing: the block editor with a map block in the
 * post. Drawn in the landing page's house style, not a screenshot — a
 * screenshot of wp-admin dates the moment WordPress restyles it.
 */
export function WordPressBlockArt() {
  const scope = useArtLoop<SVGSVGElement>(SEQUENCE, 1.6);

  return (
    <svg
      ref={scope}
      aria-hidden="true"
      viewBox={`0 0 ${W} ${H}`}
      className="h-full w-full"
      preserveAspectRatio="xMidYMid meet"
    >
      <defs>
        <clipPath id="wp-hero-block">
          <rect x={BLOCK.x} y={BLOCK.y} width={BLOCK.width} height={BLOCK.height} rx="8" />
        </clipPath>
      </defs>

      <ArtWindow {...WINDOW} bar={30} />

      {/* The editor's top bar: the W, the inserter, the title, Publish. */}
      <circle cx={WINDOW.x + 17} cy={WINDOW.y + 15} r="7" fill="var(--foreground)" opacity="0.7" />
      <rect x={WINDOW.x + 32} y={WINDOW.y + 8} width="14" height="14" rx="3" fill="var(--foreground)" opacity="0.7" />
      <path
        d={`M${WINDOW.x + 39} ${WINDOW.y + 11.5}v7M${WINDOW.x + 35.5} ${WINDOW.y + 15}h7`}
        stroke="var(--surface)"
        strokeWidth="1.6"
        strokeLinecap="round"
      />
      <rect x={WINDOW.x + 120} y={WINDOW.y + 11} width="80" height="8" rx="4" fill="var(--foreground)" opacity="0.08" />
      <rect x={WINDOW.x + 262} y={WINDOW.y + 8} width="46" height="14" rx="4" fill={ART_PIN.accent} opacity="0.9" />

      {/* The post: a title, a paragraph. */}
      <rect x={BLOCK.x} y="62" width="120" height="9" rx="4.5" fill="var(--foreground)" opacity="0.5" />
      <rect x={BLOCK.x} y="80" width="200" height="5" rx="2.5" fill="var(--muted)" opacity="0.45" />
      <rect x={BLOCK.x} y="90" width="150" height="5" rx="2.5" fill="var(--muted)" opacity="0.45" />

      <ArtBlockPlaceholder {...BLOCK} />

      {/* The map once set up. Opaque, so it covers the placeholder. */}
      <g data-art="map">
        <rect x={BLOCK.x} y={BLOCK.y} width={BLOCK.width} height={BLOCK.height} rx="8" fill="var(--surface)" />
        <rect
          x={BLOCK.x}
          y={BLOCK.y}
          width={BLOCK.width}
          height={BLOCK.height}
          rx="8"
          fill="var(--foreground)"
          opacity="0.04"
        />
        <g clipPath="url(#wp-hero-block)">
          <ArtStreets x={BLOCK.x} y={BLOCK.y} width={BLOCK.width} height={BLOCK.height} />
        </g>
      </g>

      {PINS.map((pin) => (
        <ArtDropPin key={pin.id} {...pin} />
      ))}
      <ArtDropPin {...MAIN} color={ART_PIN.accent} r={7} halo />

      <g data-art="card">
        <g transform={`translate(${CARD.x} ${CARD.y}) scale(${CARD.scale})`}>
          <ArtCard x={0} y={0} />
        </g>
      </g>

      {/* Our sheet, over the editor. Hidden in the finished frame. */}
      <g data-art="sheet" opacity="0">
        <ArtWindow {...SHEET} bar={0} />
        <ArtMapPicker {...SHEET} />
      </g>

      <ArtCursor {...REST} />
    </svg>
  );
}
