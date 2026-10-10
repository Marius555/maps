"use client";

import type { AnimationSequence } from "motion/react";

import { ART_PIN, ArtPin } from "@/components/marketing/art/art-pin";
import { useArtLoop } from "@/components/marketing/steps/art/use-art-loop";

import { ArtBlockPlaceholder } from "../../art/art-block-placeholder";
import { ArtCursor, cursorTo, PRESS } from "../../art/art-cursor";
import { ArtWindow } from "../../art/art-window";

const W = 360;
const H = 240;

const WINDOW = { x: 20, y: 16, width: 320, height: 208 } as const;
const BLOCK = { x: 60, y: 104, width: 240, height: 96 } as const;
const PANEL = { x: 36, y: 50, width: 150, height: 150 } as const;
const PLUS = { x: WINDOW.x + 39, y: WINDOW.y + 15 } as const;
const SEARCH = { x: PANEL.x + 10, y: PANEL.y + 10, width: 130, height: 20 } as const;
const TYPED_WIDTH = 46;

/** The inserter's tiles, three by two. The first is ours. */
const TILE = { width: 36, height: 34, gap: 8 } as const;
const tileAt = (index: number) => ({
  x: PANEL.x + 10 + (index % 3) * (TILE.width + TILE.gap),
  y: PANEL.y + 42 + Math.floor(index / 3) * (TILE.height + TILE.gap),
});
const OURS = tileAt(0);
const OURS_MID = { x: OURS.x + TILE.width / 2, y: OURS.y + TILE.height / 2 } as const;

const REST = { x: 312, y: 206 } as const;
const EASE = [0.4, 0, 0.2, 1] as const;

/**
 * Step two, in three beats: the inserter opens, "Pinglide" is typed and the
 * other blocks fall away, and the Pinglide map block drops into the post.
 */
const SEQUENCE: AnimationSequence = [
  ['[data-art="block"]', { opacity: 0, y: -6 }, { duration: 0.3, at: 0 }],

  // Open the inserter.
  ['[data-art="cursor"]', cursorTo(REST, PLUS), { duration: 0.7, ease: EASE, at: 0.4 }],
  ['[data-art="cursor"]', PRESS, { duration: 0.3, at: 1.15 }],
  ['[data-art="plus"]', { scale: [1, 0.85, 1] }, { duration: 0.3, at: 1.15 }],
  ['[data-art="panel"]', { opacity: 1, y: [-6, 0] }, { duration: 0.3, ease: EASE, at: 1.3 }],

  // Search. Both lists are held at their first value from the loop's start,
  // which is harmless: the panel is hidden until 1.3.
  ['[data-art="type"]', { width: [0, TYPED_WIDTH] }, { duration: 0.7, ease: "linear", at: 1.55 }],
  ['[data-art="tile-other"]', { opacity: 0.2 }, { duration: 0.25, at: 2.3 }],
  ['[data-art="tile-ring"]', { opacity: 1 }, { duration: 0.25, at: 2.3 }],

  // Pick it.
  ['[data-art="cursor"]', cursorTo(REST, OURS_MID), { duration: 0.5, ease: EASE, at: 2.4 }],
  ['[data-art="cursor"]', PRESS, { duration: 0.3, at: 3.0 }],
  ['[data-art="tile-ours"]', { scale: [1, 0.9, 1] }, { duration: 0.3, at: 3.0 }],
  ['[data-art="panel"]', { opacity: 0, y: -6 }, { duration: 0.25, at: 3.2 }],
  ['[data-art="tile-other"]', { opacity: 1 }, { duration: 0.01, at: 3.5 }],
  ['[data-art="tile-ring"]', { opacity: 0 }, { duration: 0.01, at: 3.5 }],
  ['[data-art="block"]', { opacity: 1, y: 0 }, { duration: 0.45, ease: "backOut", at: 3.35 }],
  ['[data-art="cursor"]', { x: 0, y: 0 }, { duration: 0.8, ease: EASE, at: 3.9 }],
];

/** The block editor, its + inserter, and the block it adds. */
export function InsertArt() {
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
        <clipPath id="wp-insert-type">
          <rect data-art="type" x={SEARCH.x + 20} y={SEARCH.y + 2} width={TYPED_WIDTH} height={SEARCH.height - 4} />
        </clipPath>
      </defs>

      <ArtWindow {...WINDOW} bar={30} />

      {/* The editor's top bar, the inserter pressable. */}
      <circle cx={WINDOW.x + 17} cy={WINDOW.y + 15} r="7" fill="var(--foreground)" opacity="0.7" />
      <g data-art="plus">
        <rect x={PLUS.x - 7} y={PLUS.y - 7} width="14" height="14" rx="3" fill="var(--foreground)" opacity="0.7" />
        <path
          d={`M${PLUS.x} ${PLUS.y - 3.5}v7M${PLUS.x - 3.5} ${PLUS.y}h7`}
          stroke="var(--surface)"
          strokeWidth="1.6"
          strokeLinecap="round"
        />
      </g>
      <rect x={WINDOW.x + 120} y={WINDOW.y + 11} width="80" height="8" rx="4" fill="var(--foreground)" opacity="0.08" />
      <rect x={WINDOW.x + 262} y={WINDOW.y + 8} width="46" height="14" rx="4" fill={ART_PIN.accent} opacity="0.9" />

      {/* The post. */}
      <rect x={BLOCK.x} y="62" width="120" height="9" rx="4.5" fill="var(--foreground)" opacity="0.5" />
      <rect x={BLOCK.x} y="80" width="200" height="5" rx="2.5" fill="var(--muted)" opacity="0.45" />
      <rect x={BLOCK.x} y="90" width="150" height="5" rx="2.5" fill="var(--muted)" opacity="0.45" />

      <g data-art="block">
        <ArtBlockPlaceholder {...BLOCK} />
      </g>

      {/* The inserter. Hidden in the finished frame. */}
      <g data-art="panel" opacity="0">
        <ArtWindow {...PANEL} bar={0} />
        <rect {...SEARCH} rx="6" fill="var(--foreground)" opacity="0.05" />
        <circle cx={SEARCH.x + 10} cy={SEARCH.y + 9.5} r="3.5" fill="none" stroke="var(--muted)" strokeWidth="1.3" />
        <path d={`M${SEARCH.x + 12.5} ${SEARCH.y + 12}l2.5 2.5`} stroke="var(--muted)" strokeWidth="1.3" strokeLinecap="round" />
        <text
          x={SEARCH.x + 20}
          y={SEARCH.y + 13.5}
          fontSize="9"
          fill="var(--foreground)"
          clipPath="url(#wp-insert-type)"
        >
          Pinglide
        </text>

        {[1, 2, 3, 4, 5].map((index) => {
          const tile = tileAt(index);

          return (
            <g key={index} data-art="tile-other">
              <rect x={tile.x} y={tile.y} width={TILE.width} height={TILE.height} rx="6" fill="var(--foreground)" opacity="0.05" />
              <rect x={tile.x + 12} y={tile.y + 8} width="12" height="10" rx="2" fill="var(--muted)" opacity="0.5" />
              <rect x={tile.x + 8} y={tile.y + 24} width="20" height="3.5" rx="1.75" fill="var(--muted)" opacity="0.45" />
            </g>
          );
        })}

        <g data-art="tile-ours">
          <rect x={OURS.x} y={OURS.y} width={TILE.width} height={TILE.height} rx="6" fill={ART_PIN.accent} fillOpacity="0.1" />
          <rect
            data-art="tile-ring"
            x={OURS.x - 0.5}
            y={OURS.y - 0.5}
            width={TILE.width + 1}
            height={TILE.height + 1}
            rx="6.5"
            fill="none"
            stroke={ART_PIN.accent}
            strokeWidth="1.5"
            opacity="0"
          />
          <ArtPin x={OURS.x + TILE.width / 2} y={OURS.y + 13} color={ART_PIN.accent} r={5} />
          <rect x={OURS.x + 8} y={OURS.y + 24} width="20" height="3.5" rx="1.75" fill="var(--foreground)" opacity="0.5" />
        </g>
      </g>

      <ArtCursor {...REST} />
    </svg>
  );
}
