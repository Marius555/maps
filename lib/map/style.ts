/**
 * Basemap presets.
 *
 * OpenFreeMap's public instance is fine for development (CLAUDE.md §7). Before
 * the first paying customer this points at our own PMTiles extract on R2 —
 * a public instance carries no uptime guarantee.
 */

export const MAP_STYLES = ["liberty", "bright", "positron"] as const;
export type MapStyleKey = (typeof MAP_STYLES)[number];

export const DEFAULT_MAP_STYLE: MapStyleKey = "liberty";

export const STYLE_URLS: Record<MapStyleKey, string> = {
  liberty: "https://tiles.openfreemap.org/styles/liberty",
  bright: "https://tiles.openfreemap.org/styles/bright",
  positron: "https://tiles.openfreemap.org/styles/positron",
};

export const STYLE_LABELS: Record<MapStyleKey, string> = {
  liberty: "Liberty",
  bright: "Bright",
  positron: "Positron",
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
