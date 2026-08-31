import type { StyleTint } from "@/packages/shared/style-tint";
import { MIDNIGHT_TINT } from "@/packages/shared/darken-style";

/**
 * Basemap presets.
 *
 * OpenFreeMap's public instance is fine for development (CLAUDE.md §7). Before
 * the first paying customer this points at our own PMTiles extract on R2 —
 * a public instance carries no uptime guarantee.
 *
 * There are two kinds of preset here and the difference is the whole design.
 * A **source** is a style document OpenFreeMap publishes: one URL, five of them,
 * all from the same origin and the same `openmaptiles` vector source, so they
 * cost no new CORS surface and no money. A **theme** has no URL at all — it is
 * one of those documents recoloured in the browser by a `StyleTint` (see
 * packages/shared/style-tint.ts). That is why there can be sixteen looks here
 * instead of five: a theme is about fifteen numbers, and adding a real sixth
 * style document would mean adding a second tile provider.
 */

/** The five real basemaps. Each of these is one URL. */
export const BASEMAP_SOURCES = [
  "liberty",
  "bright",
  "positron",
  "dark",
  "fiord",
] as const;
export type BasemapSource = (typeof BASEMAP_SOURCES)[number];

/**
 * Where the five basemaps are served from.
 *
 * Unset — the normal case today — means OpenFreeMap's public instance, and every
 * URL below is byte-for-byte what it has always been. Set it and the whole app
 * moves, because `resolveStyleUrl` is what `buildSnapshot` bakes into a
 * published file (lib/snapshot/build.ts): switching tile hosts is a republish,
 * not a redeploy of every customer's embed. Same shape as `gazetteerBase`
 * (lib/gazetteer/config.ts) and `embedScriptUrl`, and for the same reason —
 * development and self-hosting work with no configuration at all.
 *
 * The two hosts genuinely have different URL shapes: OpenFreeMap serves its
 * styles extensionless, ours are JSON files in a bucket. Said out loud here
 * rather than papered over, because imitating their layout would constrain ours
 * forever in exchange for one fewer branch.
 */
const OPENFREEMAP = "https://tiles.openfreemap.org";
const TILE_BASE = process.env.NEXT_PUBLIC_TILES_URL?.replace(/\/+$/, "");

/** Whether the tiles are ours. Selects the credit below, and nothing else. */
export const SELF_HOSTED_TILES = Boolean(TILE_BASE);

function styleUrlFor(source: BasemapSource): string {
  return TILE_BASE
    ? `${TILE_BASE}/styles/${source}.json`
    : `${OPENFREEMAP}/styles/${source}`;
}

export const STYLE_URLS = Object.fromEntries(
  BASEMAP_SOURCES.map((source) => [source, styleUrlFor(source)]),
) as Record<BasemapSource, string>;

/**
 * Every theme is built on Liberty, and that is not laziness.
 *
 * Liberty is the only one of the five with a full POI set, a real label
 * hierarchy and separate casings — the material a recolour needs to work with.
 * Recolouring OpenFreeMap's `dark` would produce ten variations on a style that
 * has 47 layers and no shops on it.
 */
const THEME_SOURCE: BasemapSource = "liberty";

export const THEME_KEYS = [
  "midnight",
  "carbon",
  "ember",
  "amber",
  "lagoon",
  "blueprint",
  "mono",
  "sepia",
  "verdant",
  "frost",
] as const;
export type ThemeKey = (typeof THEME_KEYS)[number];

/**
 * The two band shapes every theme is a variation on.
 *
 * Dark inverts ground and text and leaves figure alone, because roads are the
 * lightest thing on a light map and have to stay the lightest thing on a dark
 * one. Light inverts nothing and instead *expands* the top of the ground range:
 * Liberty's fills all sit above L 0.80, so without the exponent a light theme
 * collapses land, parks, buildings and water into four indistinguishable whites
 * — the same failure the dark transform hit from the other end.
 */
const DARK_HALO = "rgba(8, 8, 10, 0.85)";
const LIGHT_HALO = "rgba(255, 255, 255, 0.85)";

function darkTint(bands: {
  groundHue?: number;
  groundChroma?: number;
  figureHue?: number;
  figureChroma?: number;
  textChroma?: number;
}): StyleTint {
  return {
    ground: {
      floor: 0.15,
      range: 0.3,
      exponent: 0.5,
      invert: true,
      chroma: bands.groundHue === undefined ? (bands.groundChroma ?? 0.55) : 1,
      hue: bands.groundHue,
      hueChroma: bands.groundChroma,
    },
    figure: {
      floor: 0.22,
      range: 0.45,
      invert: false,
      chroma: bands.figureHue === undefined ? (bands.figureChroma ?? 0.8) : 1,
      hue: bands.figureHue,
      hueChroma: bands.figureChroma,
    },
    text: { floor: 0.78, range: 0.22, invert: true, chroma: bands.textChroma ?? 0.7 },
    halo: DARK_HALO,
    haloWidth: 1,
    rasterOpacity: 0.14,
    textMinAlpha: 0.9,
  };
}

function lightTint(bands: {
  groundHue?: number;
  groundChroma?: number;
  figureHue?: number;
  figureChroma?: number;
  textChroma?: number;
}): StyleTint {
  return {
    ground: {
      floor: 0.6,
      range: 0.4,
      exponent: 4,
      invert: false,
      chroma: bands.groundHue === undefined ? (bands.groundChroma ?? 0.6) : 1,
      hue: bands.groundHue,
      hueChroma: bands.groundChroma,
    },
    figure: {
      // Near-identity in lightness, unlike the dark bands. A light basemap draws
      // its roads white on near-white land and separates them with a darker
      // casing underneath; compressing the range pulls the casing up towards the
      // road and erases exactly that separation.
      floor: 0.05,
      range: 0.92,
      invert: false,
      chroma: bands.figureHue === undefined ? (bands.figureChroma ?? 0.6) : 1,
      hue: bands.figureHue,
      hueChroma: bands.figureChroma,
    },
    text: { floor: 0, range: 0.55, invert: false, chroma: bands.textChroma ?? 0.8 },
    halo: LIGHT_HALO,
    haloWidth: 1,
    rasterOpacity: 0.3,
    textMinAlpha: 0.9,
  };
}

export type MapTheme = {
  source: BasemapSource;
  label: string;
  /** Whether the map's own chrome — cards, controls, attribution — goes dark. */
  isDark: boolean;
  tint: StyleTint;
};

export const THEMES: Record<ThemeKey, MapTheme> = {
  /** Auto's dark half, pinned. Identical numbers, so the two cannot drift. */
  midnight: {
    source: THEME_SOURCE,
    label: "Midnight",
    isDark: true,
    tint: MIDNIGHT_TINT,
  },
  carbon: {
    source: THEME_SOURCE,
    label: "Carbon",
    isDark: true,
    tint: darkTint({ groundChroma: 0, figureChroma: 0, textChroma: 0 }),
  },
  ember: {
    source: THEME_SOURCE,
    label: "Ember",
    isDark: true,
    tint: darkTint({
      groundHue: 30,
      groundChroma: 0.028,
      figureHue: 32,
      figureChroma: 0.1,
      textChroma: 0.4,
    }),
  },
  amber: {
    source: THEME_SOURCE,
    label: "Amber",
    isDark: true,
    tint: darkTint({
      groundHue: 70,
      groundChroma: 0.022,
      figureHue: 82,
      figureChroma: 0.11,
      textChroma: 0.4,
    }),
  },
  lagoon: {
    source: THEME_SOURCE,
    label: "Lagoon",
    isDark: true,
    tint: darkTint({
      groundHue: 195,
      groundChroma: 0.03,
      figureHue: 190,
      figureChroma: 0.08,
      textChroma: 0.35,
    }),
  },
  blueprint: {
    source: THEME_SOURCE,
    label: "Blueprint",
    isDark: true,
    tint: darkTint({
      groundHue: 255,
      groundChroma: 0.06,
      figureHue: 250,
      figureChroma: 0.045,
      textChroma: 0.3,
    }),
  },
  mono: {
    source: THEME_SOURCE,
    label: "Mono",
    isDark: false,
    tint: lightTint({ groundChroma: 0, figureChroma: 0, textChroma: 0 }),
  },
  sepia: {
    source: THEME_SOURCE,
    label: "Sepia",
    isDark: false,
    tint: lightTint({
      groundHue: 68,
      groundChroma: 0.032,
      figureHue: 62,
      figureChroma: 0.02,
      textChroma: 0.3,
    }),
  },
  verdant: {
    source: THEME_SOURCE,
    label: "Verdant",
    isDark: false,
    tint: lightTint({
      groundHue: 145,
      groundChroma: 0.034,
      figureHue: 140,
      figureChroma: 0.018,
      textChroma: 0.3,
    }),
  },
  frost: {
    source: THEME_SOURCE,
    label: "Frost",
    isDark: false,
    tint: lightTint({
      groundHue: 235,
      groundChroma: 0.03,
      figureHue: 235,
      figureChroma: 0.016,
      textChroma: 0.3,
    }),
  },
};

/** Everything a map can actually be rendered as: five documents, ten recolours. */
export const CONCRETE_MAP_STYLES = [...BASEMAP_SOURCES, ...THEME_KEYS] as const;
export type ConcreteMapStyleKey = (typeof CONCRETE_MAP_STYLES)[number];

/**
 * What a map can be *set* to, which is everything above plus `auto`.
 *
 * `auto` is a mode, not another look: it has no colours of its own and resolves
 * against whoever is currently looking at the map — the dashboard's theme in the
 * editor, the visitor's `prefers-color-scheme` in a published embed. Keeping it
 * out of `CONCRETE_MAP_STYLES` is what lets the lookups below stay total instead
 * of every one of them needing a guard.
 */
export const MAP_STYLES = ["auto", ...CONCRETE_MAP_STYLES] as const;
export type MapStyleKey = (typeof MAP_STYLES)[number];

export const DEFAULT_MAP_STYLE: MapStyleKey = "auto";

/**
 * The style `auto` builds on, in both directions.
 *
 * Liberty either way — the dark half is this style run through `darkenStyle()`
 * rather than a different style. OpenFreeMap's own `dark` is not a usable
 * partner: 47 layers to Liberty's 111, no POI layers at all, and place labels
 * that are all one grey at ~3.4:1 on their own background. Inverting the good
 * style keeps every POI icon and Liberty's existing label hierarchy, and means
 * light and dark are genuinely the same map rather than two maps.
 *
 * `dark` and `fiord` stay selectable for anyone who wants them pinned, and
 * `midnight` is Auto's dark half pinned.
 */
export const AUTO_STYLE: BasemapSource = "liberty";

export function isThemeKey(style: MapStyleKey): style is ThemeKey {
  return style in THEMES;
}

export const STYLE_LABELS: Record<MapStyleKey, string> = {
  auto: "Auto",
  liberty: "Liberty",
  bright: "Bright",
  positron: "Positron",
  dark: "Dark",
  fiord: "Fiord",
  ...(Object.fromEntries(
    THEME_KEYS.map((key) => [key, THEMES[key].label]),
  ) as Record<ThemeKey, string>),
};

/** Which basemap sources need light chrome to become dark chrome. */
const DARK_SOURCES = new Set<BasemapSource>(["dark", "fiord"]);

export function isDarkMapStyle(style: ConcreteMapStyleKey): boolean {
  return isThemeKey(style)
    ? THEMES[style].isDark
    : DARK_SOURCES.has(style as BasemapSource);
}

export function isAutoMapStyle(style: MapStyleKey): boolean {
  return style === "auto";
}

/**
 * Swatch colours, lifted from each style document's own layers so a tile in the
 * gallery cannot disagree with the map it stands for.
 *
 * Only the sources are listed: a theme's swatch is its source's palette run
 * through the theme's own tint, which is the same code the map runs and so
 * cannot drift from it either. Sampled from `background`, the `water` fill, the
 * park fill, the minor-road and motorway lines and the city label.
 */
export type StylePalette = {
  land: string;
  water: string;
  park: string;
  road: string;
  /**
   * The outline drawn under a road. On a light basemap this is the *only* thing
   * separating a white street from near-white land, so a swatch that leaves it
   * out shows an empty field where the real map has a street grid.
   */
  casing: string;
  trunk: string;
  label: string;
};

export const STYLE_PALETTES: Record<BasemapSource, StylePalette> = {
  liberty: {
    land: "#f8f4f0",
    water: "rgb(158,189,255)",
    park: "#d8e8c8",
    road: "#ffffff",
    casing: "#cfcdca",
    trunk: "#ffcc88",
    label: "#000000",
  },
  bright: {
    land: "#f8f4f0",
    water: "#AECFE2",
    park: "#d8e8c8",
    road: "#ffffff",
    casing: "#cfcdca",
    trunk: "#ffcc88",
    label: "#000000",
  },
  positron: {
    land: "rgb(242,243,240)",
    water: "rgb(194,200,202)",
    park: "rgb(230,233,229)",
    road: "#ffffff",
    casing: "rgb(213,213,213)",
    trunk: "hsl(0,0%,88%)",
    label: "#000000",
  },
  dark: {
    land: "rgb(12,12,12)",
    water: "rgb(27,27,29)",
    park: "rgb(32,32,32)",
    road: "#2a2a2a",
    casing: "rgb(60,60,60)",
    trunk: "#3a3a3a",
    label: "rgb(101,101,101)",
  },
  fiord: {
    land: "#45516E",
    water: "#38435C",
    park: "hsl(232,18%,30%)",
    road: "hsl(224,22%,45%)",
    casing: "hsl(224,22%,45%)",
    trunk: "#3C4357",
    label: "hsl(195,37%,73%)",
  },
};

/**
 * Attribution for OpenStreetMap and the tile provider must be visible on every
 * rendered map, including the embed. Non-negotiable (CLAUDE.md §12).
 *
 * A pair per tile host, chosen by the same variable that chooses the style URLs.
 * The two halves have to travel together: the markup is what a snapshot carries
 * and what the map controls render, and the plain text is what the exporter
 * paints onto a PNG or PDF. A credit still naming OpenFreeMap once the tiles are
 * ours would be false on every exported file — quietly, with nothing to catch it,
 * which is exactly the failure §12 exists to prevent.
 *
 * Written out rather than derived by stripping tags at runtime: this is the
 * legally load-bearing line, and a regex over it is one bad edit away from
 * quietly rendering an empty credit. `style.test.ts` holds each pair's two
 * halves to each other, which catches the drift a derivation was supposed to
 * prevent without putting a parser between us and a constant.
 */
export type TileCredit = {
  /** Rendered on a map, and carried in a published snapshot. */
  html: string;
  /**
   * The same words with no markup, for a surface that has no DOM to put them in.
   *
   * An exported PNG or PDF is a rendered map and §12 applies to it in full, but a
   * canvas capture cannot contain MapLibre's attribution control — that control
   * is DOM sitting over the canvas, not pixels in it. So the exporter paints this
   * string on instead (lib/export/compose.ts).
   */
  text: string;
};

const OSM_HTML =
  '© <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noreferrer">OpenStreetMap</a> contributors';
const OSM_TEXT = "© OpenStreetMap contributors";

export const OPENFREEMAP_CREDIT: TileCredit = {
  html: `${OSM_HTML} · tiles by <a href="https://openfreemap.org" target="_blank" rel="noreferrer">OpenFreeMap</a>`,
  text: `${OSM_TEXT} · tiles by OpenFreeMap`,
};

/**
 * Our own planetiler output: OpenStreetMap for the data, OpenMapTiles for the
 * schema. No credit for us — none is owed, and a customer's basemap is not the
 * place to advertise.
 */
export const SELF_HOSTED_CREDIT: TileCredit = {
  html: `${OSM_HTML} · © <a href="https://openmaptiles.org/" target="_blank" rel="noreferrer">OpenMapTiles</a>`,
  text: `${OSM_TEXT} · © OpenMapTiles`,
};

/**
 * Every credit that can ship, so the test holds all of them to the rules rather
 * than only whichever one this environment happens to select. Without this the
 * self-hosted pair would go unchecked until the day it went live.
 */
export const TILE_CREDITS: readonly TileCredit[] = [
  OPENFREEMAP_CREDIT,
  SELF_HOSTED_CREDIT,
];

const TILE_CREDIT = SELF_HOSTED_TILES ? SELF_HOSTED_CREDIT : OPENFREEMAP_CREDIT;

export const ATTRIBUTION_HTML = TILE_CREDIT.html;
export const ATTRIBUTION_TEXT = TILE_CREDIT.text;

export function isMapStyleKey(value: unknown): value is MapStyleKey {
  return (
    typeof value === "string" && (MAP_STYLES as readonly string[]).includes(value)
  );
}

/**
 * A selectable style → the style JSON to fetch.
 *
 * Auto resolves to Liberty whichever way the viewer leans, and so does every
 * theme; what changes is what gets applied to it afterwards. The single place
 * `auto` stops being abstract, so the editor and the snapshot generator cannot
 * drift on what it means.
 */
export function resolveMapStyle(style: MapStyleKey): ConcreteMapStyleKey {
  return style === "auto" ? AUTO_STYLE : style;
}

export function styleSourceOf(style: MapStyleKey): BasemapSource {
  const resolved = resolveMapStyle(style);

  return isThemeKey(resolved) ? THEMES[resolved].source : (resolved as BasemapSource);
}

export function resolveStyleUrl(style: MapStyleKey): string {
  return STYLE_URLS[styleSourceOf(style)];
}

/**
 * The recolouring a style asks for, or null for one that asks for none.
 *
 * Auto is deliberately not here: whether *it* is recoloured depends on the
 * viewer, not on the map, and that question is `shouldDarkenStyle`'s.
 */
export function resolveTint(style: MapStyleKey): StyleTint | null {
  return isThemeKey(style) ? THEMES[style].tint : null;
}

/**
 * Should this style be inverted before use?
 *
 * Only Auto ever is. A pinned basemap or theme is what its owner chose and looks
 * the same for everyone, which is the whole difference between the two.
 */
export function shouldDarkenStyle(
  style: MapStyleKey,
  prefersDark: boolean,
): boolean {
  return style === "auto" && prefersDark;
}
