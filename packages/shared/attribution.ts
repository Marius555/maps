/**
 * Credit for the place data behind the search box.
 *
 * GeoNames is CC BY 4.0: we may use it freely and must say we did. It is *not*
 * in the tile source's own TileJSON — that credits OpenStreetMap, OpenMapTiles
 * and the tile host — so unlike those three it has no other route onto the page
 * and has to be passed to MapLibre as `customAttribution`.
 *
 * Added only by maps that actually ship a gazetteer. CC BY asks for credit for
 * data we used, and a map with no place search used none.
 */
export const GEONAMES_ATTRIBUTION =
  '<a href="https://www.geonames.org/" target="_blank" rel="noreferrer">GeoNames</a>';

/**
 * Start MapLibre's compact attribution collapsed.
 *
 * `attributionControl: { compact: true }` does not mean "start as a ⓘ" — it means
 * "be collapsible". MapLibre's own `_updateCompact` adds *both* `maplibregl-compact`
 * and `maplibregl-compact-show` the first time the control is added, so the credit
 * renders as a full line of text ("OpenFreeMap © OpenMapTiles Data from
 * OpenStreetMap") until the visitor's first interaction with the map minimises it.
 *
 * Note the inverted convention, which is MapLibre's and not a mistake here: the
 * control is a `<details>` element whose `<summary>` is the ⓘ button, so native
 * `open` would expand it — MapLibre therefore uses `open` for the *collapsed*
 * state and drives the expanded one from `maplibregl-compact-show`. This mirrors
 * its private `_updateCompactMinimize` exactly.
 *
 * Attribution is not being removed. CLAUDE.md §12 makes OpenStreetMap and
 * tile-provider credit non-negotiable on every rendered map; it stays in the DOM,
 * stays visible as a control, and is one click from being read in full — which is
 * the affordance OSM's own guidance expects where space is constrained.
 *
 * Takes the container element rather than the map so it can live here, in the one
 * directory both build targets read, with no import of its own (CLAUDE.md §4).
 */
export function collapseAttribution(container: HTMLElement): void {
  const control = container.querySelector(".maplibregl-ctrl-attrib");
  if (!control) return;

  control.classList.remove("maplibregl-compact-show");
  control.setAttribute("open", "");
}
