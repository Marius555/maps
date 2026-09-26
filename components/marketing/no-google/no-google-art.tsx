"use client";

import type { AnimationSequence, Segment } from "motion/react";

import { ART_PIN, ART_RAISED, ArtPin } from "../art/art-pin";
import { ArtStreets } from "../art/art-streets";
import { useArtLoop } from "../steps/art/use-art-loop";

const W = 360;
const H = 240;

const WINDOW = { x: 14, y: 20, width: 144, height: 200 } as const;
const MAP = { x: 24, y: 50, width: 124, height: 160 } as const;
const MAIN_PIN = { x: 86, y: 128 } as const;
const OTHER_PINS = [
  { x: 50, y: 82 },
  { x: 122, y: 76 },
  { x: 58, y: 176 },
  { x: 128, y: 184 },
];

/** Where every request leaves the page: the window's right edge, level with the pin. */
const SOURCE = { x: WINDOW.x + WINDOW.width, y: MAIN_PIN.y } as const;

const ROW = { x: 196, width: 150, height: 36, gap: 12, top: 26 } as const;

/**
 * What a published map loads, in order, and the one thing it never does. The
 * hosts are the real ones (CLAUDE.md §0: R2 behind cdn.pinglide.com, tiles on
 * OpenFreeMap) — this is a picture of a network panel, not a metaphor for one.
 */
const REQUESTS = [
  { file: "map.js", host: "cdn.pinglide.com" },
  { file: "your-map.json", host: "cdn.pinglide.com" },
  { file: "tiles.pbf", host: "openfreemap.org" },
] as const;

const GOOGLE_INDEX = REQUESTS.length;

const rowTop = (index: number) => ROW.top + index * (ROW.height + ROW.gap);
const rowMid = (index: number) => rowTop(index) + ROW.height / 2;
const checkX = ROW.x + ROW.width - 16;

function linkPath(index: number): string {
  const y = rowMid(index);
  const mid = (SOURCE.x + ROW.x) / 2;

  return `M${SOURCE.x} ${SOURCE.y}C${mid} ${SOURCE.y} ${mid} ${y} ${ROW.x - 4} ${y}`;
}

const EASE = [0.4, 0, 0.2, 1] as const;
const STEP_S = 0.7;
const FIRST_S = 0.6;

/**
 * The page loads its map: the lines and ticks clear, then each request draws
 * out to its host and is ticked off, one after another. Last, the strike through
 * the Google row draws again — the request that is not in the list.
 *
 * Single targets throughout, so every track animates from wherever it is rather
 * than jumping to a first keyframe at time zero (see useArtLoop). The server
 * draws the finished frame, every row ticked, and the loop ends on it.
 */
const SEQUENCE: AnimationSequence = [
  ['[data-art="link"]', { pathLength: 0 }, { duration: 0.3, at: 0 }],
  ['[data-art="check"]', { pathLength: 0 }, { duration: 0.3, at: 0 }],
  ['[data-art="strike"]', { pathLength: 0 }, { duration: 0.3, at: 0 }],
  ['[data-art="main"]', { scale: [1, 1.25, 1] }, { duration: 0.4, at: 0.3 }],
  ...REQUESTS.flatMap((_, index): Segment[] => {
    const at = FIRST_S + index * STEP_S;

    return [
      [`[data-link="${index}"]`, { pathLength: 1 }, { duration: 0.45, ease: EASE, at }],
      [`[data-dot="${index}"]`, { scale: [1, 1.2, 1] }, { duration: 0.35, at: at + 0.4 }],
      [`[data-check="${index}"]`, { pathLength: 1 }, { duration: 0.3, ease: EASE, at: at + 0.45 }],
    ];
  }),
  [
    '[data-art="strike"]',
    { pathLength: 1 },
    { duration: 0.45, ease: EASE, at: FIRST_S + REQUESTS.length * STEP_S + 0.2 },
  ],
];

/**
 * A customer's page with the map in it, and beside it every request the map
 * makes — three rows to our CDN and the open tile host, ticked, and a fourth,
 * Google's, struck through because it never happens.
 */
export function NoGoogleArt() {
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
        <clipPath id="no-google-window">
          <rect x={WINDOW.x} y={WINDOW.y} width={WINDOW.width} height={WINDOW.height} rx="12" />
        </clipPath>
        <clipPath id="no-google-map">
          <rect x={MAP.x} y={MAP.y} width={MAP.width} height={MAP.height} rx="8" />
        </clipPath>
      </defs>

      {/* The customer's page: a toolbar band, three dots, and their map. */}
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
      <g clipPath="url(#no-google-window)">
        <rect
          x={WINDOW.x}
          y={WINDOW.y}
          width={WINDOW.width}
          height="22"
          fill="var(--foreground)"
          opacity="0.04"
        />
      </g>
      <g fill="var(--muted)" opacity="0.5">
        <circle cx={WINDOW.x + 14} cy={WINDOW.y + 11} r="3" />
        <circle cx={WINDOW.x + 24} cy={WINDOW.y + 11} r="3" />
        <circle cx={WINDOW.x + 34} cy={WINDOW.y + 11} r="3" />
      </g>

      <rect
        x={MAP.x}
        y={MAP.y}
        width={MAP.width}
        height={MAP.height}
        rx="8"
        fill="var(--foreground)"
        opacity="0.04"
      />
      <g clipPath="url(#no-google-map)">
        <ArtStreets x={MAP.x} y={MAP.y} width={MAP.width} height={MAP.height} />
      </g>
      {OTHER_PINS.map((pin, index) => (
        <ArtPin key={index} x={pin.x} y={pin.y} />
      ))}
      <g data-art="main">
        <ArtPin x={MAIN_PIN.x} y={MAIN_PIN.y} color={ART_PIN.accent} r={7} halo />
      </g>

      {/* The requests, drawn from the page out to each host. */}
      <g fill="none" stroke={ART_PIN.accent} strokeWidth="1.6" strokeLinecap="round">
        {REQUESTS.map((_, index) => (
          <path key={index} data-art="link" data-link={index} d={linkPath(index)} />
        ))}
      </g>
      <path
        d={linkPath(GOOGLE_INDEX)}
        fill="none"
        stroke="var(--muted)"
        strokeWidth="1.4"
        strokeLinecap="round"
        strokeDasharray="2 4"
        opacity="0.5"
      />

      {REQUESTS.map((request, index) => {
        const top = rowTop(index);
        const mid = rowMid(index);

        return (
          <g key={request.file}>
            <g style={ART_RAISED}>
              <rect
                x={ROW.x}
                y={top}
                width={ROW.width}
                height={ROW.height}
                rx="9"
                fill="var(--surface)"
              />
            </g>
            <text
              x={ROW.x + 12}
              y={top + 15}
              className="font-mono"
              fontSize="10"
              fill="var(--foreground)"
            >
              {request.file}
            </text>
            <text
              x={ROW.x + 12}
              y={top + 27}
              className="font-mono"
              fontSize="8.5"
              fill="var(--muted)"
            >
              {request.host}
            </text>
            <circle data-dot={index} cx={checkX} cy={mid} r="8" fill={ART_PIN.accent} />
            <path
              data-art="check"
              data-check={index}
              d={`M${checkX - 4} ${mid + 0.5}l2.8 2.8l5.2-5.6`}
              fill="none"
              stroke="var(--accent-foreground)"
              strokeWidth="1.8"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </g>
        );
      })}

      {/* Google's row: an outline with nothing in it, struck through. */}
      <GoogleRow top={rowTop(GOOGLE_INDEX)} />
    </svg>
  );
}

function GoogleRow({ top }: { top: number }) {
  const host = "maps.googleapis.com";
  // Mono at 9 units is about 5.4 per character.
  const strikeEnd = ROW.x + 12 + host.length * 5.4 + 2;

  return (
    <g>
      <rect
        x={ROW.x + 0.75}
        y={top + 0.75}
        width={ROW.width - 1.5}
        height={ROW.height - 1.5}
        rx="9"
        fill="none"
        stroke="var(--muted)"
        strokeWidth="1.2"
        strokeDasharray="3 3"
        opacity="0.55"
      />
      <text
        x={ROW.x + 12}
        y={top + 15}
        className="font-mono"
        fontSize="9"
        fill="var(--muted)"
      >
        {host}
      </text>
      <text
        x={ROW.x + 12}
        y={top + 27}
        className="font-mono"
        fontSize="8.5"
        fill="var(--muted)"
        opacity="0.8"
      >
        never requested
      </text>
      <path
        data-art="strike"
        d={`M${ROW.x + 10} ${top + 12}L${strikeEnd} ${top + 12}`}
        fill="none"
        stroke={ART_PIN.accent}
        strokeWidth="1.6"
        strokeLinecap="round"
      />
    </g>
  );
}
