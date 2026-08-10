/**
 * Basemap presets.
 *
 * OpenFreeMap's public instance is fine for development (CLAUDE.md §7). Before
 * the first paying customer this points at our own PMTiles extract on R2 —
 * a public instance carries no uptime guarantee.
 *
 * All five concrete styles come from the same OpenFreeMap origin, share the
 * `openmaptiles` vector source, and use the same sprite and glyph endpoints, so
 * the dark ones introduced no new origin, no new CORS surface and no cost.
 */

/** The five real basemaps. Each of these is one URL. */
export const CONCRETE_MAP_STYLES = [
  "liberty",
  "bright",
  "positron",
  "dark",
  "fiord",
] as const;
export type ConcreteMapStyleKey = (typeof CONCRETE_MAP_STYLES)[number];

/**
 * What a map can be *set* to, which is the five above plus `auto`.
 *
 * `auto` is a mode, not a sixth look: it has no URL of its own and resolves
 * against whoever is currently looking at the map — the dashboard's theme in the
 * editor, the visitor's `prefers-color-scheme` in a published embed. Keeping it
 * out of `CONCRETE_MAP_STYLES` is what lets `STYLE_URLS[style]` stay total
 * instead of every lookup needing a guard.
 */
export const MAP_STYLES = ["auto", ...CONCRETE_MAP_STYLES] as const;
export type MapStyleKey = (typeof MAP_STYLES)[number];

export const DEFAULT_MAP_STYLE: MapStyleKey = "auto";

/**
 * The style `auto` builds on, in both directions.
 *
 * Liberty either way — the dark half is this style run through
 * `darkenStyle()` rather than a different style. OpenFreeMap's own `dark` is not
 * a usable partner: 47 layers to Liberty's 111, no POI layers at all, and place
 * labels that are all one grey at ~3.4:1 on their own background. Inverting the
 * good style keeps every POI icon and Liberty's existing label hierarchy, and
 * means light and dark are genuinely the same map rather than two maps.
 *
 * `dark` and `fiord` stay selectable for anyone who wants them pinned.
 */
export const AUTO_STYLE: ConcreteMapStyleKey = "liberty";

export const STYLE_URLS: Record<ConcreteMapStyleKey, string> = {
  liberty: "https://tiles.openfreemap.org/styles/liberty",
  bright: "https://tiles.openfreemap.org/styles/bright",
  positron: "https://tiles.openfreemap.org/styles/positron",
  dark: "https://tiles.openfreemap.org/styles/dark",
  fiord: "https://tiles.openfreemap.org/styles/fiord",
};

export const STYLE_LABELS: Record<MapStyleKey, string> = {
  auto: "Auto",
  liberty: "Liberty",
  bright: "Bright",
  positron: "Positron",
  dark: "Dark",
  fiord: "Fiord",
};

/** Which concrete styles need light chrome to become dark chrome. */
const DARK_STYLES = new Set<ConcreteMapStyleKey>(["dark", "fiord"]);

export function isDarkMapStyle(style: ConcreteMapStyleKey): boolean {
  return DARK_STYLES.has(style);
}

export function isAutoMapStyle(style: MapStyleKey): boolean {
  return style === "auto";
}

/**
 * Swatch colours for the basemap picker, lifted from each style's own
 * `background` and `water` layers so a tile never disagrees with its swatch.
 */
export const STYLE_SWATCHES: Record<
  ConcreteMapStyleKey,
  { background: string; water: string }
> = {
  liberty: { background: "#f8f4f0", water: "rgb(158,189,255)" },
  bright: { background: "#f8f4f0", water: "#AECFE2" },
  positron: { background: "rgb(242,243,240)", water: "rgb(194,200,202)" },
  dark: { background: "rgb(12,12,12)", water: "rgb(27,27,29)" },
  fiord: { background: "#45516E", water: "#38435C" },
};

/**
 * Attribution for OpenStreetMap and the tile provider must be visible on every
 * rendered map, including the embed. Non-negotiable (CLAUDE.md §12).
 */
export const ATTRIBUTION_HTML =
  '© <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noreferrer">OpenStreetMap</a> contributors · tiles by <a href="https://openfreemap.org" target="_blank" rel="noreferrer">OpenFreeMap</a>';

export function isMapStyleKey(value: unknown): value is MapStyleKey {
  return (
    typeof value === "string" && (MAP_STYLES as readonly string[]).includes(value)
  );
}

/**
 * A selectable style → the style JSON to fetch.
 *
 * Auto resolves to Liberty whichever way the viewer leans; what changes is
 * whether it gets darkened afterwards. The single place `auto` stops being
 * abstract, so the editor and the snapshot generator cannot drift on what it
 * means.
 */
export function resolveMapStyle(style: MapStyleKey): ConcreteMapStyleKey {
  return style === "auto" ? AUTO_STYLE : style;
}

export function resolveStyleUrl(style: MapStyleKey): string {
  return STYLE_URLS[resolveMapStyle(style)];
}

/**
 * Should this style be inverted before use?
 *
 * Only Auto ever is. A pinned basemap is what its owner chose and looks the same
 * for everyone, which is the whole difference between the two.
 */
export function shouldDarkenStyle(
  style: MapStyleKey,
  prefersDark: boolean,
): boolean {
  return style === "auto" && prefersDark;
}
