"use client";

import type { AnimationSequence } from "motion/react";

import { ART_CARD, ArtCard } from "../../art/art-card";
import { ART_PIN, ART_RAISED, ArtPin } from "../../art/art-pin";
import { ArtStreets } from "../../art/art-streets";
import { useArtLoop } from "./use-art-loop";

const W = 360;
const H = 240;

const PANEL = { x: 18, y: 30, width: 128, height: 164 } as const;
const MAP = { x: 160, y: 22, width: 182, height: 196 } as const;
const ANCHOR = { x: 196, y: 124 } as const;

/** The two basemap swatches, 54 units apart, and the two pin colours, 26 apart. */
const SWATCH = { x: 14, y: 28, width: 46, height: 32, step: 54 } as const;
const CHIP = { x: 24, y: 104, step: 26 } as const;

const EASE = [0.4, 0, 0.2, 1] as const;

/**
 * The choices, made one after another and then undone: the basemap goes dark,
 * the pins change colour, the card closes and opens again, and everything goes
 * back. It ends on the server's drawing, so each repeat carries on from it.
 */
const SEQUENCE: AnimationSequence = [
  ['[data-art="swatch-ring"]', { x: SWATCH.step }, { duration: 0.45, ease: EASE, at: 0 }],
  ['[data-art="dark"]', { opacity: 1 }, { duration: 0.55, ease: EASE, at: 0.1 }],
  ['[data-art="chip-ring"]', { x: CHIP.step }, { duration: 0.4, ease: EASE, at: 1.4 }],
  ['[data-art="pin-alt"]', { opacity: 1 }, { duration: 0.35, at: 1.45 }],
  ['[data-art="card"]', { opacity: 0, scale: 0.85 }, { duration: 0.2, at: 2.6 }],
  ['[data-art="card"]', { opacity: 1, scale: 1 }, { duration: 0.45, ease: "backOut", at: 2.95 }],
  ['[data-art="swatch-ring"]', { x: 0 }, { duration: 0.45, ease: EASE, at: 4.2 }],
  ['[data-art="dark"]', { opacity: 0 }, { duration: 0.55, ease: EASE, at: 4.3 }],
  ['[data-art="chip-ring"]', { x: 0 }, { duration: 0.4, ease: EASE, at: 5.5 }],
  ['[data-art="pin-alt"]', { opacity: 0 }, { duration: 0.35, at: 5.55 }],
];

/**
 * Step two: the choices, and what they do — a style panel on the left, and on
 * the map a pin with its card open.
 *
 * Neutrals and the accent. The dark basemap is the page's own foreground laid
 * over the map, which is why on the dark site the "other look" comes out light:
 * the swatch means *the other one*, and the drawing stays inside the palette.
 */
export function DesignArt() {
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
        <clipPath id="design-map">
          <rect x={MAP.x} y={MAP.y} width={MAP.width} height={MAP.height} rx="12" />
        </clipPath>
      </defs>

      {/* The map, light, with its dark look laid over it and faded out. */}
      <g style={ART_RAISED}>
        <rect x={MAP.x} y={MAP.y} width={MAP.width} height={MAP.height} rx="12" fill="var(--surface)" />
      </g>
      <g clipPath="url(#design-map)">
        <ArtStreets x={MAP.x} y={MAP.y} width={MAP.width} height={MAP.height} />
        <g data-art="dark" opacity="0">
          <rect
            x={MAP.x}
            y={MAP.y}
            width={MAP.width}
            height={MAP.height}
            fill="var(--foreground)"
            opacity="0.88"
          />
          <ArtStreets
            x={MAP.x}
            y={MAP.y}
            width={MAP.width}
            height={MAP.height}
            ink="var(--surface)"
          />
        </g>
      </g>

      <ArtPin x={186} y={56} />
      <ArtPin x={276} y={46} />
      <ArtPin x={184} y={196} />
      <ArtPin x={318} y={200} />

      {/* The style panel. */}
      <g transform={`translate(${PANEL.x} ${PANEL.y})`}>
        <g style={ART_RAISED}>
          <rect width={PANEL.width} height={PANEL.height} rx="12" fill="var(--surface)" />
        </g>

        <rect x="14" y="14" width="44" height="5" rx="2.5" fill="var(--muted)" opacity="0.7" />
        <Swatch x={SWATCH.x} light />
        <Swatch x={SWATCH.x + SWATCH.step} />
        <rect
          data-art="swatch-ring"
          x={SWATCH.x - 3}
          y={SWATCH.y - 3}
          width={SWATCH.width + 6}
          height={SWATCH.height + 6}
          rx="8"
          fill="none"
          stroke={ART_PIN.accent}
          strokeWidth="2"
        />

        <rect x="14" y="80" width="30" height="5" rx="2.5" fill="var(--muted)" opacity="0.7" />
        <circle cx={CHIP.x} cy={CHIP.y} r="7" fill={ART_PIN.accent} />
        <circle cx={CHIP.x + CHIP.step} cy={CHIP.y} r="7" fill="var(--foreground)" />
        <circle
          data-art="chip-ring"
          cx={CHIP.x}
          cy={CHIP.y}
          r="10.5"
          fill="none"
          stroke={ART_PIN.accent}
          strokeWidth="2"
        />

        <rect x="14" y="128" width="36" height="5" rx="2.5" fill="var(--muted)" opacity="0.7" />
        <rect x="14" y="142" width="70" height="4" rx="2" fill="var(--foreground)" opacity="0.12" />
        <rect x="14" y="152" width="52" height="4" rx="2" fill="var(--foreground)" opacity="0.12" />
      </g>

      <g data-art="card">
        <ArtCard x={ANCHOR.x + 22} y={ANCHOR.y - ART_CARD.height / 2} />
      </g>

      {/* The chosen pin, in the accent, with its foreground twin over it for
          when the other colour is picked. */}
      <ArtPin x={ANCHOR.x} y={ANCHOR.y} color={ART_PIN.accent} r={7} halo />
      <g data-art="pin-alt" opacity="0">
        <ArtPin x={ANCHOR.x} y={ANCHOR.y} color="var(--foreground)" r={7} halo />
      </g>
    </svg>
  );
}

/** A basemap, drawn as the look it stands for: its ground and one road. */
function Swatch({ x, light = false }: { x: number; light?: boolean }) {
  const { y, width, height } = SWATCH;

  return (
    <g>
      <rect
        x={x}
        y={y}
        width={width}
        height={height}
        rx="6"
        fill="var(--foreground)"
        opacity={light ? 0.07 : 0.85}
      />
      <path
        d={`M${x} ${y + 21}C${x + 14} ${y + 16} ${x + 28} ${y + 26} ${x + width} ${y + 14}M${x + 30} ${y}L${x + 24} ${y + height}`}
        fill="none"
        stroke="var(--surface)"
        strokeWidth="3"
        opacity={light ? 1 : 0.35}
      />
    </g>
  );
}
