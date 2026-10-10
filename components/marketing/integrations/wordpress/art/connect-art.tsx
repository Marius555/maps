"use client";

import type { AnimationSequence } from "motion/react";

import { ART_PIN } from "@/components/marketing/art/art-pin";
import { ArtStreets } from "@/components/marketing/art/art-streets";
import { useArtLoop } from "@/components/marketing/steps/art/use-art-loop";

import { ArtCursor, cursorTo, PRESS } from "../../art/art-cursor";
import { ArtDropPin, dropPins, liftPins } from "../../art/art-drop-pin";
import { ArtMapPicker, PICKER_ROW, pickerLayout } from "../../art/art-map-picker";
import { ArtWindow } from "../../art/art-window";

const W = 360;
const H = 240;

const WINDOW = { x: 20, y: 16, width: 320, height: 208 } as const;
const MAP = { x: 40, y: 92, width: 280, height: 116 } as const;
const SHEET = { x: 96, y: 52, width: 168, height: 150 } as const;
const PICKER = pickerLayout(SHEET.x, SHEET.y, SHEET.width, SHEET.height);

const PINS = [
  { id: "a", x: 78, y: 122 },
  { id: "b", x: 150, y: 176 },
  { id: "c", x: 214, y: 118 },
  { id: "d", x: 288, y: 168 },
  { id: "e", x: 250, y: 190 },
] as const;
const MAIN = { id: "main", x: 176, y: 140 } as const;
const ALL = [...PINS.map((pin) => pin.id), MAIN.id];

const REST = { x: 306, y: 206 } as const;
const EASE = [0.4, 0, 0.2, 1] as const;
const ROW_STEP = PICKER_ROW + 4;

/**
 * Step three, in three beats: on our side the owner moves down their maps and
 * picks one, Connect ticks, and back on their WordPress page the map's pins
 * drop in.
 */
const SEQUENCE: AnimationSequence = [
  ...liftPins(ALL, 0),
  ['[data-art="picker"]', { opacity: 1 }, { duration: 0.35, at: 0.3 }],

  // Down the list.
  ['[data-art="cursor"]', cursorTo(REST, PICKER.rowMid(1)), { duration: 0.5, ease: EASE, at: 0.75 }],
  ['[data-art="picker-highlight"]', { y: ROW_STEP }, { duration: 0.25, ease: EASE, at: 1.0 }],
  ['[data-art="cursor"]', cursorTo(REST, PICKER.rowMid(2)), { duration: 0.35, ease: EASE, at: 1.4 }],
  ['[data-art="picker-highlight"]', { y: ROW_STEP * 2 }, { duration: 0.25, ease: EASE, at: 1.55 }],
  ['[data-art="cursor"]', PRESS, { duration: 0.3, at: 1.85 }],

  // Connect.
  ['[data-art="cursor"]', cursorTo(REST, PICKER.connectMid), { duration: 0.45, ease: EASE, at: 2.2 }],
  ['[data-art="cursor"]', PRESS, { duration: 0.3, at: 2.7 }],
  ['[data-art="connect"]', { scale: [1, 0.94, 1] }, { duration: 0.3, at: 2.7 }],
  // Held at 0 from the loop's start, harmless: the picker is hidden until 0.3.
  ['[data-art="connect-check"]', { pathLength: [0, 1], opacity: [0, 1] }, { duration: 0.3, ease: EASE, at: 2.8 }],

  // Back on WordPress.
  ['[data-art="picker"]', { opacity: 0 }, { duration: 0.35, at: 3.25 }],
  ['[data-art="picker-highlight"]', { y: 0 }, { duration: 0.01, at: 3.65 }],
  ...dropPins(ALL, 3.5),
  ['[data-art="cursor"]', { x: 0, y: 0 }, { duration: 0.8, ease: EASE, at: 3.7 }],
];

/** A browser: our map picker, then the owner's WordPress page with the map on it. */
export function ConnectArt() {
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
        <clipPath id="wp-connect-window">
          <rect {...WINDOW} rx="12" />
        </clipPath>
        <clipPath id="wp-connect-map">
          <rect {...MAP} rx="8" />
        </clipPath>
      </defs>

      <ArtWindow {...WINDOW} dots />

      {/* Their page: a title, a line, the map. */}
      <rect x={MAP.x} y="56" width="130" height="9" rx="4.5" fill="var(--foreground)" opacity="0.5" />
      <rect x={MAP.x} y="74" width="200" height="5" rx="2.5" fill="var(--muted)" opacity="0.45" />
      <rect {...MAP} rx="8" fill="var(--foreground)" opacity="0.04" />
      <g clipPath="url(#wp-connect-map)">
        <ArtStreets {...MAP} />
      </g>
      {PINS.map((pin) => (
        <ArtDropPin key={pin.id} {...pin} />
      ))}
      <ArtDropPin {...MAIN} color={ART_PIN.accent} r={7} halo />

      {/* Our side, over the whole page. Hidden in the finished frame. */}
      <g data-art="picker" opacity="0">
        <g clipPath="url(#wp-connect-window)">
          <rect x={WINDOW.x} y={WINDOW.y + 26} width={WINDOW.width} height={WINDOW.height - 26} fill="var(--surface)" />
          <rect
            x={WINDOW.x}
            y={WINDOW.y + 26}
            width={WINDOW.width}
            height={WINDOW.height - 26}
            fill="var(--foreground)"
            opacity="0.03"
          />
        </g>
        <ArtWindow {...SHEET} bar={0} />
        <ArtMapPicker {...SHEET} />
      </g>

      <ArtCursor {...REST} />
    </svg>
  );
}
