"use client";

import type { AnimationSequence } from "motion/react";

import { ART_PIN, ArtPin } from "@/components/marketing/art/art-pin";
import { useArtLoop } from "@/components/marketing/steps/art/use-art-loop";

import { ArtCursor, cursorTo, PRESS } from "../../art/art-cursor";
import { ArtWindow } from "../../art/art-window";

const W = 360;
const H = 240;

const WINDOW = { x: 20, y: 16, width: 320, height: 208 } as const;
const DROP = { x: 78, y: 70, width: 244, height: 60 } as const;
const ROW = { x: 78, y: 142, width: 244, height: 56 } as const;
const BUTTON = { x: 254, y: 160, width: 58, height: 20 } as const;
const PROGRESS = { x: 110, y: 97, width: 180 } as const;

const REST = { x: 300, y: 204 } as const;
const DROP_MID = { x: DROP.x + DROP.width / 2, y: DROP.y + DROP.height / 2 } as const;
const BUTTON_MID = { x: BUTTON.x + BUTTON.width / 2, y: BUTTON.y + BUTTON.height / 2 } as const;

const EASE = [0.4, 0, 0.2, 1] as const;
const toDrop = cursorTo(REST, DROP_MID);

/**
 * Step one, in three beats: the zip is carried into **Upload Plugin**, a
 * progress bar fills, and the plugin's row arrives and is activated. The file
 * travels with the cursor by the same offset, so it is held, not chased.
 */
const SEQUENCE: AnimationSequence = [
  ['[data-art="row"]', { opacity: 0, y: 8 }, { duration: 0.3, at: 0 }],
  ['[data-art="active"]', { opacity: 0, scale: 0.9 }, { duration: 0.01, at: 0.3 }],

  // Carry the zip in.
  ['[data-art="file"]', { opacity: 1 }, { duration: 0.25, at: 0.4 }],
  ['[data-art="cursor"]', toDrop, { duration: 0.8, ease: EASE, at: 0.7 }],
  ['[data-art="file"]', toDrop, { duration: 0.8, ease: EASE, at: 0.7 }],
  ['[data-art="cursor"]', PRESS, { duration: 0.3, at: 1.5 }],
  ['[data-art="file"]', { opacity: 0, scale: 0.6 }, { duration: 0.25, at: 1.6 }],
  ['[data-art="hint"]', { opacity: 0 }, { duration: 0.2, at: 1.6 }],
  ['[data-art="file"]', { x: 0, y: 0, scale: 1 }, { duration: 0.01, at: 2.0 }],

  // Upload.
  ['[data-art="progress"]', { opacity: 1 }, { duration: 0.15, at: 1.7 }],
  // Held at 0 from the loop's start, harmless: the bar is hidden until 1.7.
  ['[data-art="progress-fill"]', { width: [0, PROGRESS.width] }, { duration: 0.8, ease: "easeInOut", at: 1.75 }],
  ['[data-art="progress"]', { opacity: 0 }, { duration: 0.2, at: 2.6 }],
  ['[data-art="hint"]', { opacity: 1 }, { duration: 0.2, at: 2.75 }],

  // The row arrives; Activate.
  ['[data-art="row"]', { opacity: 1, y: 0 }, { duration: 0.4, ease: "backOut", at: 2.7 }],
  ['[data-art="cursor"]', cursorTo(REST, BUTTON_MID), { duration: 0.6, ease: EASE, at: 2.9 }],
  ['[data-art="cursor"]', PRESS, { duration: 0.3, at: 3.55 }],
  ['[data-art="activate"]', { scale: [1, 0.94, 1] }, { duration: 0.3, at: 3.55 }],
  ['[data-art="active"]', { opacity: 1, scale: 1 }, { duration: 0.35, ease: "backOut", at: 3.65 }],
  ['[data-art="cursor"]', { x: 0, y: 0 }, { duration: 0.8, ease: EASE, at: 4.15 }],
];

/** wp-admin's Add Plugins screen: the dark menu, the upload zone, the plugin's row. */
export function InstallArt() {
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
        <clipPath id="wp-install-window">
          <rect {...WINDOW} rx="12" />
        </clipPath>
      </defs>

      <ArtWindow {...WINDOW} dots />

      {/* The admin menu, Plugins lit. */}
      <g clipPath="url(#wp-install-window)">
        <rect x={WINDOW.x} y={WINDOW.y + 26} width="44" height={WINDOW.height - 26} fill="var(--foreground)" opacity="0.78" />
      </g>
      {[56, 70, 84, 112, 126].map((y) => (
        <rect key={y} x={WINDOW.x + 9} y={y} width="26" height="4" rx="2" fill="var(--surface)" opacity="0.35" />
      ))}
      <rect x={WINDOW.x + 4} y="94" width="36" height="12" rx="3" fill={ART_PIN.accent} />
      <rect x={WINDOW.x + 9} y="98" width="22" height="4" rx="2" fill="var(--accent-foreground)" opacity="0.9" />

      {/* Add Plugins, and the upload zone. */}
      <text x={DROP.x} y="60" fontSize="10" fontWeight="600" fill="var(--foreground)">
        Add Plugins
      </text>
      <rect
        x={DROP.x + 0.5}
        y={DROP.y + 0.5}
        width={DROP.width - 1}
        height={DROP.height - 1}
        rx="8"
        fill="var(--foreground)"
        fillOpacity="0.03"
        stroke="var(--muted)"
        strokeOpacity="0.55"
        strokeDasharray="4 3"
      />
      <g data-art="hint">
        <path
          d={`M${DROP_MID.x} ${DROP_MID.y - 12}v12M${DROP_MID.x - 5} ${DROP_MID.y - 7}l5-5l5 5`}
          fill="none"
          stroke="var(--muted)"
          strokeWidth="1.6"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <text x={DROP_MID.x} y={DROP_MID.y + 14} textAnchor="middle" fontSize="8.5" fill="var(--muted)">
          Upload Plugin
        </text>
      </g>
      <g data-art="progress" opacity="0">
        <rect x={PROGRESS.x} y={PROGRESS.y} width={PROGRESS.width} height="6" rx="3" fill="var(--foreground)" opacity="0.08" />
        <rect
          data-art="progress-fill"
          x={PROGRESS.x}
          y={PROGRESS.y}
          width={PROGRESS.width}
          height="6"
          rx="3"
          fill={ART_PIN.accent}
        />
      </g>

      {/* The plugin, installed. */}
      <g data-art="row">
        <rect {...ROW} rx="8" fill="var(--foreground)" opacity="0.04" />
        <rect x={ROW.x + 10} y={ROW.y + 10} width="36" height="36" rx="8" fill={ART_PIN.accent} fillOpacity="0.14" />
        <ArtPin x={ROW.x + 28} y={ROW.y + 28} color={ART_PIN.accent} r={6} />
        <text x={ROW.x + 56} y={ROW.y + 24} fontSize="10" fontWeight="600" fill="var(--foreground)">
          Pinglide Maps
        </text>
        <rect x={ROW.x + 56} y={ROW.y + 32} width="96" height="4" rx="2" fill="var(--muted)" opacity="0.45" />

        <g data-art="activate">
          <rect
            x={BUTTON.x + 0.5}
            y={BUTTON.y + 0.5}
            width={BUTTON.width - 1}
            height={BUTTON.height - 1}
            rx={BUTTON.height / 2}
            fill="var(--surface)"
            stroke="var(--foreground)"
            strokeOpacity="0.5"
          />
          <text x={BUTTON_MID.x} y={BUTTON.y + 13.5} textAnchor="middle" fontSize="8.5" fontWeight="500" fill="var(--foreground)">
            Activate
          </text>
        </g>
        <g data-art="active">
          <rect {...BUTTON} rx={BUTTON.height / 2} fill={ART_PIN.accent} />
          <path
            d={`M${BUTTON.x + 10} ${BUTTON.y + 10.5}l2.6 2.6l4.8-5.2`}
            fill="none"
            stroke="var(--accent-foreground)"
            strokeWidth="1.8"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          <text x={BUTTON.x + 22} y={BUTTON.y + 13.5} fontSize="8.5" fontWeight="600" fill="var(--accent-foreground)">
            Active
          </text>
        </g>
      </g>

      {/* The zip, under the cursor's tip. Hidden in the finished frame. */}
      <g data-art="file" opacity="0">
        <path
          d={`M${REST.x - 13} ${REST.y - 18}h18l8 8v26h-26z`}
          fill="var(--surface)"
          stroke="var(--foreground)"
          strokeOpacity="0.55"
          strokeWidth="1.2"
          strokeLinejoin="round"
        />
        <path d={`M${REST.x + 5} ${REST.y - 18}v8h8`} fill="none" stroke="var(--foreground)" strokeOpacity="0.55" strokeWidth="1.2" />
        <rect x={REST.x - 10} y={REST.y + 1} width="22" height="10" rx="2" fill={ART_PIN.accent} />
        <text x={REST.x + 1} y={REST.y + 8.5} textAnchor="middle" fontSize="6.5" fontWeight="700" fill="var(--accent-foreground)">
          ZIP
        </text>
      </g>

      <ArtCursor {...REST} />
    </svg>
  );
}
