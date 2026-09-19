"use client";

import type { AnimationSequence } from "motion/react";

import { ART_PIN, ART_RAISED, ArtPin } from "../../art/art-pin";
import { ArtStreets } from "../../art/art-streets";
import { useArtLoop } from "./use-art-loop";

const W = 360;
const H = 240;

const SHEET = { x: 22, y: 34, width: 150, row: 26 } as const;
const TILE = { x: 214, y: 40, width: 124, height: 148 } as const;

/** Name and address bar widths per row, and the pin each row becomes. */
const ROWS = [
  { name: 52, address: 38, pin: { x: 244, y: 70 } },
  { name: 44, address: 46, pin: { x: 268, y: 104 } },
  { name: 58, address: 32, pin: { x: 306, y: 80 } },
  { name: 40, address: 42, pin: { x: 238, y: 148 } },
  { name: 50, address: 36, pin: { x: 304, y: 158 } },
];

/** The row the server draws lit, and the row every loop ends on. */
const START = 1;

const SHEET_HEIGHT = SHEET.row * (ROWS.length + 1);

const rowTop = (index: number) => SHEET.y + SHEET.row * (index + 1);
const rowMid = (index: number) => rowTop(index) + SHEET.row / 2;

/** From the sheet's edge at a row to just short of that row's pin. */
function linkPath(index: number): string {
  const sx = SHEET.x + SHEET.width + 6;
  const sy = rowMid(index);
  const { x, y } = ROWS[index].pin;

  return `M${sx} ${sy}C${sx + 36} ${sy} ${x - 34} ${y} ${x - 9} ${y}`;
}

const EASE = [0.4, 0, 0.2, 1] as const;
const STEP_S = 1.5;

/**
 * A ripple out of a pin. Three keyframes rather than two, and the first one is
 * the ripple at rest — invisible — because a sequence holds each track's first
 * keyframe from the very start of the loop: `opacity: [0.45, 0]` left every
 * ripple sitting at 0.45 under its pin until its turn came round.
 */
const RIPPLE = { opacity: [0, 0.45, 0], scale: [0.6, 0.6, 2.6] };

/**
 * One row after another: the highlight moves down the sheet, a line draws from
 * that row to its place on the map, and the pin lands with a ripple.
 *
 * Visits every other row and finishes on `START`, which is where the server
 * drew it — so a repeat carries straight on (see useArtLoop).
 *
 * **Every keyframe list here starts at the element's resting value**, or is a
 * single target. A sequence holds a track's first keyframe from time zero, not
 * from the segment's own start, so `opacity: [1, 1]` on a line had every line
 * showing — as a dot, at pathLength 0 — until its row's turn.
 */
const SEQUENCE: AnimationSequence = (() => {
  const order = [2, 3, 4, 0, START];
  const sequence: AnimationSequence = [];
  let previous = START;

  order.forEach((row, index) => {
    const at = index * STEP_S;

    sequence.push(
      ['[data-art="highlight"]', { y: (row - START) * SHEET.row }, { duration: 0.45, ease: EASE, at }],
      [`[data-row-dot="${previous}"]`, { opacity: 0 }, { duration: 0.2, at }],
      [`[data-row-dot="${row}"]`, { opacity: 1 }, { duration: 0.2, at }],
      [`[data-link="${previous}"]`, { opacity: 0 }, { duration: 0.25, at }],
      [`[data-pin="${previous}"]`, { opacity: 0 }, { duration: 0.25, at }],
      [
        `[data-link="${row}"]`,
        { pathLength: [0, 1], opacity: 1 },
        { duration: 0.55, ease: EASE, at: at + 0.25 },
      ],
      [
        `[data-pin="${row}"]`,
        { opacity: 1, scale: [1, 1.3, 1] },
        { duration: 0.45, at: at + 0.75 },
      ],
      [
        `[data-ripple="${row}"]`,
        RIPPLE,
        { duration: 0.75, ease: "easeOut", times: [0, 0.02, 1], at: at + 0.8 },
      ],
    );

    previous = row;
  });

  return sequence;
})();

/**
 * Step one: a spreadsheet on the left, a map on the right, and one row at a
 * time followed across to the pin it becomes.
 *
 * Neutrals and the accent, nothing else: the rows and the pins waiting their
 * turn are grey, and the one being imported is the only colour in the picture.
 */
export function ImportArt() {
  const scope = useArtLoop<SVGSVGElement>(SEQUENCE);

  return (
    <svg
      ref={scope}
      aria-hidden="true"
      viewBox={`0 0 ${W} ${H}`}
      className="h-full w-full"
      preserveAspectRatio="xMidYMid meet"
    >
      <defs>
        <clipPath id="import-sheet">
          <rect x={SHEET.x} y={SHEET.y} width={SHEET.width} height={SHEET_HEIGHT} rx="10" />
        </clipPath>
        <clipPath id="import-tile">
          <rect x={TILE.x} y={TILE.y} width={TILE.width} height={TILE.height} rx="12" />
        </clipPath>
      </defs>

      {/* The sheet: a header row and five locations. */}
      <g style={ART_RAISED}>
        <rect
          x={SHEET.x}
          y={SHEET.y}
          width={SHEET.width}
          height={SHEET_HEIGHT}
          rx="10"
          fill="var(--surface)"
        />
      </g>
      <g clipPath="url(#import-sheet)">
        <rect
          x={SHEET.x}
          y={SHEET.y}
          width={SHEET.width}
          height={SHEET.row}
          fill="var(--foreground)"
          opacity="0.05"
        />
        <rect x={SHEET.x + 14} y={SHEET.y + 11} width="24" height="4" rx="2" fill="var(--muted)" opacity="0.7" />
        <rect x={SHEET.x + 62} y={SHEET.y + 11} width="34" height="4" rx="2" fill="var(--muted)" opacity="0.7" />

        <rect
          data-art="highlight"
          x={SHEET.x}
          y={rowTop(START)}
          width={SHEET.width}
          height={SHEET.row}
          fill="color-mix(in oklab, var(--accent) 12%, transparent)"
        />

        {ROWS.map((row, index) => (
          <g key={index}>
            <circle cx={SHEET.x + 18} cy={rowMid(index)} r="4" fill={ART_PIN.muted} opacity="0.5" />
            <circle
              data-row-dot={index}
              cx={SHEET.x + 18}
              cy={rowMid(index)}
              r="4"
              fill={ART_PIN.accent}
              opacity={index === START ? 1 : 0}
            />
            <rect
              x={SHEET.x + 30}
              y={rowMid(index) - 2.5}
              width={row.name}
              height="5"
              rx="2.5"
              fill="var(--foreground)"
              opacity="0.5"
            />
            <rect
              x={SHEET.x + 36 + row.name}
              y={rowMid(index) - 2.5}
              width={row.address}
              height="5"
              rx="2.5"
              fill="var(--muted)"
              opacity="0.45"
            />
          </g>
        ))}
      </g>

      {/* The map the rows land on. */}
      <g style={ART_RAISED}>
        <rect
          x={TILE.x}
          y={TILE.y}
          width={TILE.width}
          height={TILE.height}
          rx="12"
          fill="var(--surface)"
        />
      </g>
      <g clipPath="url(#import-tile)">
        <ArtStreets x={TILE.x} y={TILE.y} width={TILE.width} height={TILE.height} />
      </g>

      {/* Each row's line to its pin, under the pins so a pin sits on the end of
          its own line. Only the lit row's is visible. */}
      {ROWS.map((_, index) => (
        <path
          key={index}
          data-link={index}
          d={linkPath(index)}
          fill="none"
          stroke={ART_PIN.accent}
          strokeWidth="2"
          opacity={index === START ? 1 : 0}
        />
      ))}

      {ROWS.map(({ pin }, index) => (
        <g key={index}>
          <circle
            data-ripple={index}
            cx={pin.x}
            cy={pin.y}
            r="7"
            fill={ART_PIN.accent}
            opacity="0"
          />
          <ArtPin x={pin.x} y={pin.y} />
          <circle
            data-pin={index}
            cx={pin.x}
            cy={pin.y}
            r="7"
            fill={ART_PIN.accent}
            stroke="var(--surface)"
            strokeWidth="2.5"
            opacity={index === START ? 1 : 0}
          />
        </g>
      ))}
    </svg>
  );
}
