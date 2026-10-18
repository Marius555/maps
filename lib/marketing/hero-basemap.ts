/**
 * The hero picture's roads, drawn quieter than any customer's map draws them.
 *
 * **Why the hero needs its own.** Liberty draws every road as a fill over a
 * casing, sized for a map somebody reads streets off. The hero is a ground to
 * put pins on, seen at zoom 10.8 across the whole of London — and at that
 * scale the casings and fills of a few thousand roads merged into a mesh that
 * was most of the picture: thick grey on Carbon, white on Mono (owner,
 * 2026-10-18: "it looks like the whole map is white"). So the hero keeps the
 * roads as thin hairlines, the larger ones a little heavier, and drops the
 * casings and the small streets entirely.
 *
 * **Only the hero images run this.** It is applied in
 * `components/marketing/hero/generator/render-hero-map.ts`, after the look's
 * own appearance, and nothing a customer publishes passes through it — the
 * shared pipeline in packages/shared/map-appearance.ts is untouched.
 *
 * **Constant widths, not scaled expressions.** The picture is rendered at one
 * zoom (`HERO_CAMERA`), so a number is exact; and multiplying Liberty's
 * `interpolate` by a factor would put a zoom expression below the top level,
 * which MapLibre refuses.
 */

type Layer = {
  id: string;
  type: string;
  "source-layer"?: string;
  layout?: Record<string, unknown>;
  paint?: Record<string, unknown>;
};

type StyleWithLayers = { layers?: Layer[] };

/**
 * Widths in CSS pixels at the hero's zoom, by what Liberty's layer id says the
 * road is (after its `road_` / `bridge_` / `tunnel_` prefix). Anything not
 * named here — streets, service roads, paths, rail — is hidden.
 */
export const HERO_ROAD_WIDTHS: Readonly<Record<string, number>> = {
  motorway: 1.3,
  trunk_primary: 0.9,
  motorway_link: 0.6,
  link: 0.5,
  secondary_tertiary: 0.5,
};

/** How much of each road's colour shows: hairlines, not the picture's subject. */
export const HERO_ROAD_OPACITY = 0.7;

const PREFIX = /^(road|bridge|tunnel)_/;

/** The road kind a Liberty transportation layer draws, or null if it is not a road fill. */
function roadKind(layer: Layer): string | null {
  if (layer.type !== "line" || layer["source-layer"] !== "transportation") {
    return null;
  }

  return PREFIX.test(layer.id) ? layer.id.replace(PREFIX, "") : null;
}

/**
 * `color` replaces the look's own road colour. Mono needs it: its roads are
 * white on a pale ground, which is legible as a casing-and-fill pair and
 * vanishes once the casing is gone, leaving London with no streets at all.
 */
export function quietHeroRoads<T extends StyleWithLayers>(
  style: T,
  { color }: { color?: string } = {},
): T {
  if (!style.layers) return style;

  const layers = style.layers.map((layer): Layer => {
    const kind = roadKind(layer);
    if (kind === null) return layer;

    const width = kind.endsWith("_casing") ? undefined : HERO_ROAD_WIDTHS[kind];

    if (width === undefined) {
      return { ...layer, layout: { ...layer.layout, visibility: "none" } };
    }

    return {
      ...layer,
      paint: {
        ...layer.paint,
        "line-width": width,
        "line-opacity": HERO_ROAD_OPACITY,
        ...(color ? { "line-color": color } : null),
      },
    };
  });

  return { ...style, layers };
}
