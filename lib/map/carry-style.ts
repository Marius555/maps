import type { StyleSpecification } from "maplibre-gl";

/**
 * Carries whatever the map gained at runtime across a style swap.
 *
 * `setStyle` diffs the incoming style against `Style.serialize()`, and that
 * serialisation includes every source and layer added with `addSource` /
 * `addLayer` — the editor's shapes, which are the one part of the canvas drawn
 * as style layers rather than as DOM markers. A basemap document knows nothing
 * about them, so the diff reads their absence as a deletion: `removeSource`,
 * plus a `removeLayer` for every layer reading from it.
 *
 * They come straight back — components/map/shapes/use-shape-layers.ts re-adds
 * them on `styledata` — but not in the same frame. `addSource` on a GeoJSON
 * source hands its features to the worker to re-tile, so every circle, polygon,
 * line and route vanished and reappeared each time somebody flipped a switch in
 * the appearance menu. That is the blink this exists to remove.
 *
 * Handed to MapLibre as `setStyle`'s `transformStyle`, it runs before the diff,
 * so the source and its layers appear on *both* sides and the diff emits nothing
 * at all for them. What is left is the paint and visibility work the change was
 * actually about.
 *
 * Deliberately generic: it never names the shape source. Anything the editor
 * adds to the map in future inherits this without being told, and `lib/map` does
 * not have to reach into `components/map/shapes` to learn an id.
 *
 * **Where the carried layers go back is the whole of the difficulty, and the
 * answer has to be the one `addShapeLayers` would have given.** That rebuild
 * path still exists — MapLibre abandons the diff and reloads the style from
 * scratch whenever the diff throws — so if the two disagreed, a map would be
 * stacked one way most of the time and the other way occasionally, which is the
 * worst of both. `addShapeLayers` anchors on the first symbol layer, so this
 * does too: under every label, so street and place names stay legible through a
 * translucent fill.
 *
 * Reading the position off `previous` instead was tried and is wrong. It is
 * exact while the style document is the same one recoloured — a theme, a layer
 * toggle — because the anchor's id is still there. It falls apart on a *basemap*
 * switch, which is the case it was supposed to earn its keep on: the five
 * OpenFreeMap documents share almost no layer ids, so the anchor is simply gone
 * and the layers land at the end of the list. Measured in the browser, that put
 * every shape fill over every label on the map.
 */
export function carryRuntimeLayers(
  previous: StyleSpecification | undefined,
  next: StyleSpecification,
): StyleSpecification {
  if (!previous) return next;

  /*
   * A source the map has and the incoming document does not was added at
   * runtime. Nothing else can produce that asymmetry: both sides describe the
   * same basemap, and the appearance transforms only rewrite layers.
   */
  const carried = Object.keys(previous.sources).filter(
    (id) => !(id in next.sources),
  );

  // The overwhelmingly common case — an untouched map, or a canvas that has
  // never drawn a shape. Returning `next` by reference keeps it free.
  if (carried.length === 0) return next;

  const carriedIds = new Set(carried);
  const carriedLayers = previous.layers.filter(
    (layer) => "source" in layer && carriedIds.has(layer.source),
  );

  // A style with no labels at all is legal, and then there is nothing to go
  // under — the end of the list is the top of the map, which is where the
  // rebuild path would put them too.
  const firstSymbol = next.layers.findIndex((layer) => layer.type === "symbol");
  const at = firstSymbol === -1 ? next.layers.length : firstSymbol;

  return {
    ...next,
    sources: {
      ...next.sources,
      ...Object.fromEntries(carried.map((id) => [id, previous.sources[id]])),
    },
    // Their own relative order is kept: whatever added them chose it.
    layers: [...next.layers.slice(0, at), ...carriedLayers, ...next.layers.slice(at)],
  };
}
