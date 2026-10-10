"use client";

import type { AnimationSequence } from "motion/react";

import { ART_PIN, ArtPin } from "@/components/marketing/art/art-pin";
import { ArtStreets } from "@/components/marketing/art/art-streets";
import { useArtLoop } from "@/components/marketing/steps/art/use-art-loop";

import { ArtCursor, cursorTo, PRESS } from "../../art/art-cursor";
import { ArtDropPin, dropPins, liftPins } from "../../art/art-drop-pin";
import { ArtWindow } from "../../art/art-window";

const W = 360;
const H = 240;

const EDITOR = { x: 16, y: 26, width: 146, height: 188 } as const;
const PAGE = { x: 184, y: 26, width: 160, height: 188 } as const;
const MAP = { x: 196, y: 82, width: 136, height: 118 } as const;

const ROW_H = 24;
const rowY = (index: number) => EDITOR.y + 34 + index * ROW_H;
/** Name widths of the locations already on the map; the fifth row is the new one. */
const ROWS = [62, 48, 70, 54] as const;
const NEW_ROW = ROWS.length;

const ADD = { x: EDITOR.x + EDITOR.width - 18, y: EDITOR.y + 13 } as const;
const PUBLISH = { x: EDITOR.x + 12, y: EDITOR.y + EDITOR.height - 30, width: EDITOR.width - 24, height: 20 } as const;
const PUBLISH_MID = { x: PUBLISH.x + PUBLISH.width / 2, y: PUBLISH.y + PUBLISH.height / 2 } as const;

const PINS = [
  { x: 218, y: 106 },
  { x: 300, y: 104 },
  { x: 230, y: 176 },
  { x: 312, y: 178 },
] as const;
const NEW_PIN = { id: "new", x: 270, y: 142 } as const;

/** From Publish, over the gap, down into the page's map where the new pin lands. */
const ARC = `M${PUBLISH.x + PUBLISH.width - 10} ${PUBLISH.y}C190 150 228 108 ${NEW_PIN.x} ${NEW_PIN.y - 12}`;

const REST = { x: 172, y: 210 } as const;
const EASE = [0.4, 0, 0.2, 1] as const;

/**
 * Three beats: a location is added on Pinglide, Publish is pressed, and the
 * change travels to the WordPress page, where the new pin drops onto the map.
 * Nothing is done on the WordPress side — which is the point being drawn.
 */
const SEQUENCE: AnimationSequence = [
  ['[data-art="new-row"]', { opacity: 0, x: -8 }, { duration: 0.3, at: 0 }],
  ...liftPins([NEW_PIN.id], 0),

  // Add a location.
  ['[data-art="cursor"]', cursorTo(REST, ADD), { duration: 0.7, ease: EASE, at: 0.4 }],
  ['[data-art="cursor"]', PRESS, { duration: 0.3, at: 1.15 }],
  ['[data-art="add"]', { scale: [1, 0.85, 1] }, { duration: 0.3, at: 1.15 }],
  ['[data-art="new-row"]', { opacity: 1, x: 0 }, { duration: 0.4, ease: "backOut", at: 1.3 }],

  // Publish.
  ['[data-art="cursor"]', cursorTo(REST, PUBLISH_MID), { duration: 0.6, ease: EASE, at: 1.8 }],
  ['[data-art="cursor"]', PRESS, { duration: 0.3, at: 2.45 }],
  ['[data-art="publish"]', { scale: [1, 0.96, 1] }, { duration: 0.3, at: 2.45 }],

  // It travels; the page follows. The arc's pathLength is held at 0 from the
  // loop's start, which is harmless: it is invisible until 2.6.
  ['[data-art="arc"]', { opacity: 1 }, { duration: 0.1, at: 2.6 }],
  ['[data-art="arc"]', { pathLength: [0, 1] }, { duration: 0.6, ease: EASE, at: 2.6 }],
  ...dropPins([NEW_PIN.id], 3.1),
  ['[data-art="arc"]', { opacity: 0 }, { duration: 0.35, at: 3.5 }],
  ['[data-art="cursor"]', { x: 0, y: 0 }, { duration: 0.8, ease: EASE, at: 3.3 }],
];

/** Pinglide's location list on the left, the owner's WordPress page on the right. */
export function SyncArt() {
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
        <clipPath id="wp-sync-map">
          <rect {...MAP} rx="8" />
        </clipPath>
      </defs>

      {/* Pinglide: the locations, + to add one, Publish. */}
      <ArtWindow {...EDITOR} bar={26} />
      <ArtPin x={EDITOR.x + 14} y={EDITOR.y + 13} color={ART_PIN.accent} r={4} />
      <text x={EDITOR.x + 23} y={EDITOR.y + 16.5} fontSize="9" fontWeight="600" fill="var(--foreground)">
        Locations
      </text>
      <g data-art="add">
        <rect x={ADD.x - 7} y={ADD.y - 7} width="14" height="14" rx="3.5" fill="var(--foreground)" opacity="0.7" />
        <path d={`M${ADD.x} ${ADD.y - 3.5}v7M${ADD.x - 3.5} ${ADD.y}h7`} stroke="var(--surface)" strokeWidth="1.6" strokeLinecap="round" />
      </g>

      {ROWS.map((width, index) => (
        <g key={index}>
          <circle cx={EDITOR.x + 16} cy={rowY(index) + ROW_H / 2} r="3.5" fill="var(--muted)" opacity="0.75" />
          <rect x={EDITOR.x + 26} y={rowY(index) + 7} width={width} height="4.5" rx="2.25" fill="var(--foreground)" opacity="0.45" />
          <rect x={EDITOR.x + 26} y={rowY(index) + 14} width={width * 0.6} height="3.5" rx="1.75" fill="var(--muted)" opacity="0.4" />
        </g>
      ))}
      <g data-art="new-row">
        <rect x={EDITOR.x + 6} y={rowY(NEW_ROW) + 1} width={EDITOR.width - 12} height={ROW_H - 2} rx="6" fill={ART_PIN.accent} fillOpacity="0.12" />
        <circle cx={EDITOR.x + 16} cy={rowY(NEW_ROW) + ROW_H / 2} r="3.5" fill={ART_PIN.accent} />
        <rect x={EDITOR.x + 26} y={rowY(NEW_ROW) + 7} width="58" height="4.5" rx="2.25" fill="var(--foreground)" opacity="0.6" />
        <rect x={EDITOR.x + 26} y={rowY(NEW_ROW) + 14} width="36" height="3.5" rx="1.75" fill="var(--muted)" opacity="0.45" />
      </g>

      <g data-art="publish">
        <rect {...PUBLISH} rx={PUBLISH.height / 2} fill={ART_PIN.accent} />
        <text x={PUBLISH_MID.x} y={PUBLISH.y + 13.5} textAnchor="middle" fontSize="9" fontWeight="600" fill="var(--accent-foreground)">
          Publish
        </text>
      </g>

      {/* Their WordPress page, with the map on it. */}
      <ArtWindow {...PAGE} dots />
      <rect x={MAP.x} y="62" width="90" height="8" rx="4" fill="var(--foreground)" opacity="0.5" />
      <rect {...MAP} rx="8" fill="var(--foreground)" opacity="0.04" />
      <g clipPath="url(#wp-sync-map)">
        <ArtStreets {...MAP} />
      </g>
      {PINS.map((pin, index) => (
        <ArtPin key={index} {...pin} />
      ))}
      <ArtDropPin {...NEW_PIN} color={ART_PIN.accent} r={7} halo />

      {/* The publish, on its way. The faint dashes are always there: the
          link is permanent, the change is what travels along it. */}
      <path d={ARC} fill="none" stroke="var(--muted)" strokeOpacity="0.45" strokeWidth="1.4" strokeDasharray="3 4" strokeLinecap="round" />
      <path data-art="arc" d={ARC} fill="none" stroke={ART_PIN.accent} strokeWidth="2" strokeLinecap="round" opacity="0" />

      <ArtCursor {...REST} />
    </svg>
  );
}
