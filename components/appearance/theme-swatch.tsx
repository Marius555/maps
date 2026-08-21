"use client";

import { useId } from "react";

import {
  AUTO_STYLE,
  isAutoMapStyle,
  resolveTint,
  STYLE_PALETTES,
  styleSourceOf,
  type MapStyleKey,
  type StylePalette,
} from "@/lib/map/style";
import { MIDNIGHT_TINT } from "@/packages/shared/darken-style";
import { applyBand, type StyleTint } from "@/packages/shared/style-tint";

/**
 * What a theme looks like, without fetching a tile.
 *
 * Sixteen looks cannot be told apart by name, and they cannot be told apart by
 * the two-colour gradient the old picker used either — half of them are the same
 * basemap and differ only in how it was recoloured. So each tile is a tiny map:
 * land, a water inlet, a park, a couple of roads and a label bar.
 *
 * Every one of those colours is the *real* colour. It starts as a value sampled
 * from the style document's own layers (STYLE_PALETTES) and is then run through
 * the theme's own `StyleTint` — the same function, with the same numbers, that
 * the map itself runs over every fill and line. A swatch that mixed its own idea
 * of "greener" would eventually promise a map that does not exist; this one
 * cannot, short of the tint changing, in which case the swatch changes with it.
 *
 * Inline SVG rather than a rendered thumbnail: the competition ships raster
 * previews, which is a request per tile per page load. This is zero requests and
 * scales cleanly on any display.
 */

function paintedPalette(base: StylePalette, tint: StyleTint | null): StylePalette {
  if (!tint) return base;

  return {
    land: applyBand(base.land, tint.ground),
    water: applyBand(base.water, tint.ground),
    park: applyBand(base.park, tint.ground),
    road: applyBand(base.road, tint.figure),
    casing: applyBand(base.casing, tint.figure),
    trunk: applyBand(base.trunk, tint.figure),
    label: applyBand(base.label, tint.text),
  };
}

export function paletteFor(style: MapStyleKey): StylePalette {
  return paintedPalette(STYLE_PALETTES[styleSourceOf(style)], resolveTint(style));
}

export function ThemeSwatch({ style }: { style: MapStyleKey }) {
  const clipId = useId();

  /*
   * Auto is the one tile with two answers, so it shows both — light on the left,
   * the dark it would become on the right. The dark half runs MIDNIGHT_TINT,
   * which is literally the object `darkenStyle` applies, so the split tile is a
   * promise the map keeps.
   */
  if (isAutoMapStyle(style)) {
    const light = STYLE_PALETTES[AUTO_STYLE];

    return (
      <MiniMap>
        <defs>
          <clipPath id={`${clipId}-l`}>
            <rect x="0" y="0" width="32" height="40" />
          </clipPath>
          <clipPath id={`${clipId}-r`}>
            <rect x="32" y="0" width="32" height="40" />
          </clipPath>
        </defs>
        <g clipPath={`url(#${clipId}-l)`}>
          <MiniMapBody palette={light} />
        </g>
        <g clipPath={`url(#${clipId}-r)`}>
          <MiniMapBody palette={paintedPalette(light, MIDNIGHT_TINT)} />
        </g>
      </MiniMap>
    );
  }

  return (
    <MiniMap>
      <MiniMapBody palette={paletteFor(style)} />
    </MiniMap>
  );
}

function MiniMap({ children }: { children: React.ReactNode }) {
  return (
    <svg
      viewBox="0 0 64 40"
      preserveAspectRatio="none"
      aria-hidden="true"
      className="block h-full w-full"
    >
      {children}
    </svg>
  );
}

/**
 * The drawing itself, in the order a real basemap stacks: ground, then water and
 * green space, then the road network, then a label on top.
 *
 * Every road is drawn twice — a wider casing, then the road on it — because that
 * is how a basemap draws one, and on a light theme it is the only reason the
 * street grid is visible at all against near-white land.
 */
function MiniMapBody({ palette }: { palette: StylePalette }) {
  const roads = [
    { d: "M0 27 L 46 22", width: 2 },
    { d: "M28 0 L 33 40", width: 1.5 },
  ];

  return (
    <>
      <rect x="0" y="0" width="64" height="40" fill={palette.land} />

      {/* A river mouth widening into the bottom-right corner. */}
      <path d="M64 12 C 54 17 48 25 46 40 L 64 40 Z" fill={palette.water} />

      <rect x="5" y="5" width="17" height="12" rx="3" fill={palette.park} />

      {/* Two minor streets and one trunk road, which is the whole hierarchy a
          tile this size can carry. */}
      {roads.map((road) => (
        <path
          key={road.d}
          d={road.d}
          stroke={palette.casing}
          strokeWidth={road.width + 1.4}
          strokeLinecap="round"
          fill="none"
        />
      ))}
      <path
        d="M0 9 C 20 7 34 12 64 4"
        stroke={palette.casing}
        strokeWidth="4.4"
        strokeLinecap="round"
        fill="none"
      />

      {roads.map((road) => (
        <path
          key={road.d}
          d={road.d}
          stroke={palette.road}
          strokeWidth={road.width}
          strokeLinecap="round"
          fill="none"
        />
      ))}
      <path
        d="M0 9 C 20 7 34 12 64 4"
        stroke={palette.trunk}
        strokeWidth="3"
        strokeLinecap="round"
        fill="none"
      />

      <rect x="7" y="31" width="14" height="3" rx="1.5" fill={palette.label} />
    </>
  );
}
