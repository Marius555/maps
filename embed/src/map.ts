import {
  GeolocateControl,
  LngLatBounds,
  Map as MapLibreMap,
  NavigationControl,
  Popup,
  type GeoJSONSource,
  type LngLatLike,
  type MapGeoJSONFeature,
  type StyleSpecification,
} from "maplibre-gl";

import {
  collapseAttribution,
  GEONAMES_ATTRIBUTION,
} from "@/packages/shared/attribution";
import {
  resolvePin,
  UNCATEGORISED_PIN_COLOR,
  type CustomPinIcon,
} from "@/packages/shared/pin-icons";
import { shapePolygon, type AreaGeometry } from "@/packages/shared/shapes";
import type {
  MapSnapshot,
  SnapshotPlace,
  SnapshotShape,
} from "@/packages/shared/snapshot";

import { buildPopup, buildShapePopup } from "./popup";
import {
  pinImageId,
  registerPinImageBitmaps,
  registerPinImages,
} from "@/packages/shared/pin-raster";

/**
 * The map itself: source, layers, clustering and popups.
 *
 * Clustering is MapLibre's own, on the GeoJSON source, rather than a separate
 * library — it already bundles what it needs, and adding supercluster would be
 * weight in the visitor's download for something we get for free.
 *
 * Filtering re-sets the source data instead of calling `setFilter`. Clusters are
 * computed by the source, so a layer filter would hide individual pins while the
 * cluster bubbles carried on counting them.
 *
 * Places are drawn by one of two layers, never both: a circle for a location
 * with no icon, a symbol for one with an icon (see @/packages/shared/pin-raster.ts). One source
 * feeds both, so clustering still counts every place regardless of shape.
 */

const SOURCE_ID = "places";
const CLUSTER_LAYER = "clusters";
const CLUSTER_COUNT_LAYER = "cluster-count";
const POINT_LAYER = "place-points";
const PIN_LAYER = "place-pins";

const SHAPE_SOURCE_ID = "shapes";
const SHAPE_FILL_LAYER = "shape-fills";
const SHAPE_LINE_LAYER = "shape-outlines";

/** Past this zoom, show individual pins rather than bubbles. */
const CLUSTER_MAX_ZOOM = 14;
const CLUSTER_RADIUS = 50;
const FIT_PADDING = 48;
const FOCUS_ZOOM = 15;
/**
 * Where to sit when the visitor names a town rather than a shop. Lower than
 * FOCUS_ZOOM because a postcode or a city is an area, and arriving at street
 * level would hide the very locations the search was meant to surface.
 */
const AREA_ZOOM = 11;

/**
 * Pins with no category. Deliberately a neutral grey rather than the palette's
 * first colour — reusing that made an uncategorised place indistinguishable
 * from the first category, and the legend then explained a pin it didn't cover.
 */


/**
 * Popup offsets, in pixels above the point.
 *
 * Two of them because there are two sizes. Both pins are balls centred on their
 * coordinate, so each offset is that ball's radius plus the same 6px of air: 8
 * for the dot, 18 for the 36px icon pin. The icon offset was 40 when the pin was
 * a teardrop standing on its tip and every pixel of it was *above* the point.
 */
const DOT_POPUP_OFFSET = 14;
const PIN_POPUP_OFFSET = 24;

export type MapHandle = {
  setPlaces: (places: SnapshotPlace[]) => void;
  focusPlace: (place: SnapshotPlace) => void;
  /**
   * Fly to a bare coordinate — somewhere the visitor named in search, which is
   * not one of the map's own locations and so has no place to focus.
   *
   * The map goes *there* rather than fitting the results around it, because
   * "near Manchester" is a question about Manchester; framing the three nearest
   * shops instead would answer a question nobody asked and lose the town.
   */
  focusPoint: (lat: number, lng: number) => void;
  fitTo: (places: SnapshotPlace[]) => void;
  destroy: () => void;
};

export type CreateMapOptions = {
  /**
   * The basemap, already resolved by the caller: a URL for MapLibre to fetch, or
   * a recoloured style object for an Auto map being viewed in dark. Resolved
   * outside because it may need a fetch, and a constructor cannot await.
   */
  style: string | StyleSpecification;
  /**
   * A place to open on instead of the whole map, from `?place=<id>` on the host
   * page. Unknown ids are ignored, which is what lets several maps share a page.
   */
  focusPlaceId?: string | null;
  /**
   * Which place the open card belongs to, or null when nothing is open.
   *
   * The results list follows the map through this: clicking a pin marks and
   * scrolls to its row. The other direction needs nothing new — the list calls
   * `focusPlace`, which opens the popup, which reports back through here, so
   * both routes converge on one notification rather than two paths to keep in
   * step.
   */
  onSelect?: (placeId: string | null) => void;
};

export function createMap(
  container: HTMLElement,
  snapshot: MapSnapshot,
  { style, focusPlaceId = null, onSelect }: CreateMapOptions,
): MapHandle {
  const map = new MapLibreMap({
    container,
    style,
    center: [snapshot.center.lng, snapshot.center.lat],
    zoom: snapshot.center.zoom,
    /*
     * Credit for OpenStreetMap and the tile provider is non-negotiable on every
     * rendered map, the embed included (CLAUDE.md §12) — but compact, so it is
     * one small ⓘ on a customer's page rather than a bar of text glaring off a
     * dark basemap. Expanding it is one click, which is the affordance OSM's
     * attribution guidance expects for constrained space.
     *
     * `snapshot.attribution` is deliberately *not* passed: the tile source's own
     * TileJSON already credits OpenFreeMap, OpenMapTiles and OpenStreetMap, and
     * passing it as well printed all three a second time, joined by a pipe —
     * that was the doubled line. It stays in the contract because snapshots are
     * immutable, it is just no longer the thing that renders it.
     *
     * GeoNames is the exception, and precisely because it is *not* in the
     * TileJSON: it is the place data behind the search box, it is CC BY, and
     * this is its only route onto the page. Only for maps that ship a gazetteer
     * — credit is owed for data used, and a map with no place search used none.
     */
    attributionControl: {
      compact: true,
      ...(snapshot.gazetteer
        ? { customAttribution: GEONAMES_ATTRIBUTION }
        : {}),
    },
  });

  map.addControl(new NavigationControl({ showCompass: false }), "top-right");
  map.addControl(
    new GeolocateControl({ trackUserLocation: false }),
    "top-right",
  );
  // No AttributionControl is added here on purpose: the `attributionControl`
  // map option above already creates one. Adding a second renders the credit
  // twice, stacked — a different doubling from the one described above, and
  // both were live at once.

  /*
   * ...and `compact: true` only makes it collapsible, not collapsed. MapLibre
   * renders it open until the visitor first touches the map, so on a customer's
   * page the credit lands as a full line of text. Started collapsed instead —
   * still present, still one click away. See packages/shared/attribution.ts.
   */
  map.on("load", () => collapseAttribution(map.getContainer()));
  map.on("styledata", () => collapseAttribution(map.getContainer()));

  // A map on someone's landing page must not swallow the page scroll.
  map.scrollZoom.disable();
  map.on("wheel", (event) => {
    if (event.originalEvent.ctrlKey || event.originalEvent.metaKey) {
      map.scrollZoom.enable();
      return;
    }
    map.scrollZoom.disable();
  });

  const categories = new Map(
    snapshot.categories.map((category) => [category.id, category]),
  );
  const colors = colorsOf(snapshot);
  const popup = new Popup({
    closeButton: true,
    maxWidth: "280px",
    offset: DOT_POPUP_OFFSET,
  });

  let places = snapshot.places;
  /** Which place the open popup belongs to, so filtering can close a stale one. */
  let openPlaceId: string | null = null;
  /**
   * The pin images that exist. Empty until the map loads, which is fine: the
   * feature builder treats an unregistered pin as a plain dot, and the only call
   * before load is the one inside the load handler itself.
   */
  let pinImages = new Set<string>();

  /**
   * The one place `openPlaceId` is written.
   *
   * Every route into and out of a popup has to tell the list, and there are four
   * of them — a pin click, a list click, a shape click, and a filter closing a
   * card whose place has gone. Assigning the field directly at each is how one
   * of them ends up not notifying, so nothing else assigns it.
   */
  const setOpen = (id: string | null) => {
    if (openPlaceId === id) return;

    openPlaceId = id;
    onSelect?.(id);
  };

  popup.on("close", () => setOpen(null));

  map.on("load", () => {
    const pairs = pinPairs(snapshot);
    const pins = pinsOf(snapshot);

    // Before the source, because the features name the images they need and
    // MapLibre warns per feature per frame for one that isn't there yet.
    pinImages = registerPinImages(map, pairs, pins);

    /*
     * Uploaded logos cannot make that deadline — decoding one is a promise — so
     * they arrive behind the first frame and the source is fed again once they
     * land. The alternative is holding every place on the map hostage to one
     * customer's PNG. Mutated rather than reassigned so `setPlaces`, which reads
     * this same set on every filter change, needs no telling.
     */
    void registerPinImageBitmaps(map, pairs, pins).then((added) => {
      if (added.size === 0) return;

      for (const id of added) pinImages.add(id);

      const source = map.getSource(SOURCE_ID) as GeoJSONSource | undefined;
      source?.setData(toFeatureCollection(places, snapshot, pinImages));
    });

    /*
     * Shapes first, so their layers sit *under* the places.
     *
     * Nothing in this file uses `beforeId` — layers stack in the order they are
     * added — so anything added after `addLayers` would paint over the pins, and
     * a translucent wash over a customer's locations is exactly backwards. A map
     * with no shapes adds nothing at all, which is also every snapshot published
     * before shapes existed.
     */
    addShapeLayers(map, snapshot.shapes ?? []);

    map.addSource(SOURCE_ID, {
      type: "geojson",
      data: toFeatureCollection(places, snapshot, pinImages),
      cluster: snapshot.settings.clustering,
      clusterMaxZoom: CLUSTER_MAX_ZOOM,
      clusterRadius: CLUSTER_RADIUS,
    });

    addLayers(map, snapshot);
    wireInteractions(map, (place) => showPopup(place));
    wireShapeInteractions(map, snapshot.shapes ?? [], (shape, at) =>
      showShapePopup(shape, at),
    );

    /*
     * A deep link replaces the opening view rather than animating away from it.
     * Fitting the whole map and then flying to one pin shows the visitor a
     * journey they didn't ask for and delays the thing they followed the link
     * for — so this jumps, and only the popup announces itself.
     */
    const focused = focusPlaceId
      ? places.find((place) => place.id === focusPlaceId)
      : undefined;

    if (focused) {
      map.jumpTo({
        center: [focused.lng, focused.lat],
        zoom: Math.max(snapshot.center.zoom, FOCUS_ZOOM),
      });
      showPopup(focused);
    } else if (snapshot.bounds) {
      fitBounds(map, snapshot.bounds);
    }
  });

  /**
   * A shape's card, in the same single Popup the pins use.
   *
   * `openPlaceId` is cleared, not just left: it exists so a filter change can
   * close a popup whose place has been filtered away, and a shape's popup does
   * not belong to any place. Leaving the previous id set would have the next
   * filter change decide this popup is stale on the strength of a location that
   * is no longer what is open.
   */
  const showShapePopup = (shape: SnapshotShape, at: LngLatLike) => {
    setOpen(null);
    popup
      // No pin to clear, so the card sits on the point that was clicked.
      .setOffset(0)
      .setLngLat(at)
      .setDOMContent(buildShapePopup(shape))
      .addTo(map);
  };

  const showPopup = (place: SnapshotPlace) => {
    setOpen(place.id);
    // Set per place, not at construction: one Popup instance serves both pin
    // shapes, and the card has to clear whichever one it is opening over.
    popup
      .setOffset(
        pinIdFor(place, colors, pinImages) ? PIN_POPUP_OFFSET : DOT_POPUP_OFFSET,
      )
      .setLngLat([place.lng, place.lat])
      .setDOMContent(
        buildPopup(
          place,
          categories.get(place.category ?? ""),
          snapshot.fields ?? [],
        ),
      )
      .addTo(map);
  };

  return {
    /**
     * Presence of the source is the only correct readiness test here.
     *
     * Not `map.loaded()`: that reports false whenever tiles are in flight, long
     * after the `load` event has fired. Deferring to `map.once("load")` on the
     * strength of it meant filter changes made while the map was still fetching
     * tiles were queued behind an event that had already happened, and silently
     * never applied. When the source doesn't exist yet, assigning `places` is
     * enough — the load handler builds the source from it.
     */
    setPlaces: (next) => {
      places = next;

      const source = map.getSource(SOURCE_ID) as GeoJSONSource | undefined;
      if (!source) return;

      source.setData(toFeatureCollection(next, snapshot, pinImages));

      // A popup left open over a pin that has just been filtered away is a card
      // floating on empty map, with a Directions link to somewhere no longer
      // shown.
      // `remove` fires the popup's own close event, which is what clears
      // `openPlaceId` and tells the list. Clearing it here as well would be a
      // second writer for the one thing `setOpen` exists to keep single.
      if (openPlaceId && !next.some((place) => place.id === openPlaceId)) {
        popup.remove();
      }
    },

    focusPlace: (place) => {
      map.flyTo({
        center: [place.lng, place.lat],
        zoom: Math.max(map.getZoom(), FOCUS_ZOOM),
      });

      showPopup(place);
    },

    focusPoint: (lat, lng) => {
      // No popup: there is nothing here to open a card about. The list beside
      // the map is what answers, re-sorted by distance from this point.
      map.flyTo({ center: [lng, lat], zoom: Math.max(map.getZoom(), AREA_ZOOM) });
    },

    fitTo: (subset) => {
      const bounds = boundsOf(subset);
      if (bounds) map.fitBounds(bounds, { padding: FIT_PADDING, maxZoom: 16 });
    },

    destroy: () => map.remove(),
  };
}

function addLayers(map: MapLibreMap, snapshot: MapSnapshot): void {
  if (snapshot.settings.clustering) {
    map.addLayer({
      id: CLUSTER_LAYER,
      type: "circle",
      source: SOURCE_ID,
      filter: ["has", "point_count"],
      paint: {
        // Neutral, so a cluster never looks like it belongs to one category.
        "circle-color": "#3f4756",
        "circle-opacity": 0.9,
        "circle-stroke-width": 2,
        "circle-stroke-color": "#ffffff",
        "circle-radius": [
          "step",
          ["get", "point_count"],
          16,
          25,
          21,
          100,
          27,
        ],
      },
    });

    map.addLayer({
      id: CLUSTER_COUNT_LAYER,
      type: "symbol",
      source: SOURCE_ID,
      filter: ["has", "point_count"],
      layout: {
        "text-field": ["get", "point_count_abbreviated"],
        // Fonts have to exist in the style's glyph set; Noto Sans is the one
        // every OpenFreeMap style ships.
        "text-font": ["Noto Sans Regular"],
        "text-size": 12,
      },
      paint: { "text-color": "#ffffff" },
    });
  }

  map.addLayer({
    id: POINT_LAYER,
    type: "circle",
    source: SOURCE_ID,
    // Places with an icon are drawn by the symbol layer below. Without the
    // second clause they would get a dot under the pin as well.
    filter: ["all", ["!", ["has", "point_count"]], ["!", ["has", "pin"]]],
    paint: {
      // Precomputed per feature, so no match expression has to be rebuilt when
      // categories change.
      "circle-color": ["get", "color"],
      "circle-radius": 8,
      "circle-stroke-width": 2,
      "circle-stroke-color": "#ffffff",
    },
  });

  map.addLayer({
    id: PIN_LAYER,
    type: "symbol",
    source: SOURCE_ID,
    filter: ["all", ["!", ["has", "point_count"]], ["has", "pin"]],
    layout: {
      // A ball marks its position with its middle, and the image is the pin's own
      // square (@/packages/shared/pin-raster.ts) — so centring it needs no offset to keep in sync.
      "icon-image": ["get", "pin"],
      "icon-anchor": "center",
      /*
       * Symbol collision is on by default, and it is the wrong default here. Two
       * shops on the same street would silently cost one of them its pin on a
       * customer's site — a location that exists, is not filtered, and simply
       * does not appear. Overlapping pins are the lesser problem, and clustering
       * already handles the dense case.
       */
      "icon-allow-overlap": true,
      "icon-ignore-placement": true,
    },
  });
}

/**
 * Areas, under the pins.
 *
 * One fill layer and one outline, from one source. The circle's ring is generated
 * here from a centre and a radius by the same function the editor uses
 * (packages/shared/shapes.ts) — MapLibre's own `circle` layer sizes itself in
 * pixels, which would make a 2km delivery radius a different distance at every
 * zoom.
 *
 * Returns early on an empty list so a map without shapes carries no source, no
 * layers and no listeners. That is every snapshot published before this field
 * existed, and they must be unaffected.
 */
function addShapeLayers(map: MapLibreMap, shapes: SnapshotShape[]): void {
  if (shapes.length === 0) return;

  map.addSource(SHAPE_SOURCE_ID, {
    type: "geojson",
    data: {
      type: "FeatureCollection",
      features: shapes.map((shape) => ({
        type: "Feature",
        geometry: shapeOutline(shape),
        // Flat scalars only — MapLibre serialises features to its worker, and a
        // nested object does not survive the trip. Same reason a whole place is
        // stringified into one property below.
        properties: {
          id: shape.id,
          color: shape.color,
          opacity: shape.opacity,
          isLine: shape.kind === "line",
        },
      })),
    },
  });

  map.addLayer({
    id: SHAPE_FILL_LAYER,
    type: "fill",
    source: SHAPE_SOURCE_ID,
    /*
     * Areas only. A `fill` layer does not ignore a LineString — MapLibre
     * tessellates whatever points the source gives it, so without this a
     * three-point route publishes as a filled triangle with the route drawn
     * along two of its sides.
     */
    filter: ["==", ["geometry-type"], "Polygon"],
    paint: {
      "fill-color": ["get", "color"],
      "fill-opacity": ["get", "opacity"],
    },
  });

  map.addLayer({
    id: SHAPE_LINE_LAYER,
    type: "line",
    source: SHAPE_SOURCE_ID,
    layout: { "line-join": "round" },
    paint: {
      "line-color": ["get", "color"],
      // Solid whatever the fill is set to: a shape at 5% fill still has to be
      // findable, and its edge is what makes it so.
      "line-opacity": 1,
      // A line is the whole object rather than an area's edge, so it is drawn
      // heavier — and with no fill behind it, a hairline is also a thing a
      // visitor cannot reliably tap.
      "line-width": ["case", ["get", "isLine"], 4, 2],
    },
  });
}

/**
 * How a shape is drawn: a closed ring for an area, an open path for a line.
 *
 * A line is a LineString because `shapePolygon` closes whatever it is handed, and
 * a closed route is a triangle. What keeps it unfilled is the fill layer's own
 * geometry-type filter — a fill layer will happily tessellate a LineString.
 */
function shapeOutline(shape: SnapshotShape): GeoJSON.Geometry {
  if (shape.kind === "line") {
    return { type: "LineString", coordinates: shape.points };
  }

  return { type: "Polygon", coordinates: shapePolygon(toGeometry(shape)) };
}

/** The snapshot's flat shape back into the union both renderers draw from. */
function toGeometry(shape: Exclude<SnapshotShape, { kind: "line" }>): AreaGeometry {
  return shape.kind === "circle"
    ? { kind: "circle", lng: shape.lng, lat: shape.lat, radius: shape.radius }
    : { kind: "polygon", points: shape.points };
}

/**
 * Clicking an area opens its card.
 *
 * The pins are wired the same way, and MapLibre fires both layers' handlers for a
 * click on a pin that happens to sit inside a shape. The pin wins because its
 * handler runs second and replaces the popup's content — which is the right
 * answer: the visitor aimed at the pin, not at the region under it.
 */
function wireShapeInteractions(
  map: MapLibreMap,
  shapes: SnapshotShape[],
  /**
   * Takes where the visitor clicked, not the shape's centre: on a region
   * spanning the viewport, a card anchored to the middle can be off screen.
   */
  onSelect: (shape: SnapshotShape, at: LngLatLike) => void,
): void {
  if (shapes.length === 0) return;

  const byId = new Map(shapes.map((shape) => [shape.id, shape]));

  map.on("click", SHAPE_FILL_LAYER, (event) => {
    const id = event.features?.[0]?.properties?.id;
    const shape = typeof id === "string" ? byId.get(id) : undefined;
    if (!shape) return;

    onSelect(shape, event.lngLat);
  });

  map.on("mouseenter", SHAPE_FILL_LAYER, () => {
    map.getCanvas().style.cursor = "pointer";
  });
  map.on("mouseleave", SHAPE_FILL_LAYER, () => {
    map.getCanvas().style.cursor = "";
  });
}

function wireInteractions(
  map: MapLibreMap,
  onSelect: (place: SnapshotPlace) => void,
): void {
  for (const layer of [POINT_LAYER, PIN_LAYER]) {
    map.on("click", layer, (event) => {
      const feature = event.features?.[0];
      if (!feature) return;

      onSelect(readPlace(feature));
    });
  }

  map.on("click", CLUSTER_LAYER, (event) => {
    const feature = event.features?.[0];
    if (!feature) return;

    const clusterId = feature.properties?.cluster_id;
    if (typeof clusterId !== "number") return;

    const source = map.getSource(SOURCE_ID) as GeoJSONSource | undefined;
    void source?.getClusterExpansionZoom(clusterId).then((zoom) => {
      const [lng, lat] = (feature.geometry as GeoJSON.Point).coordinates;
      map.easeTo({ center: [lng, lat], zoom });
    });
  });

  for (const layer of [POINT_LAYER, PIN_LAYER, CLUSTER_LAYER]) {
    map.on("mouseenter", layer, () => {
      map.getCanvas().style.cursor = "pointer";
    });
    map.on("mouseleave", layer, () => {
      map.getCanvas().style.cursor = "";
    });
  }
}

/** Category id → hex, with the neutral grey standing in for "uncategorised". */
function colorsOf(snapshot: MapSnapshot): Map<string, string> {
  return new Map(
    snapshot.categories.map((category) => [category.id, category.color]),
  );
}

/**
 * The map's own pins, in the shape the shared resolver reads.
 *
 * Widened rather than reimplemented: `resolvePin` is what the dashboard's markers
 * and drag ghost go through too, and a second lookup here is how the pin a
 * customer arranged and the pin their visitors get quietly stop matching. The
 * label is the one field the snapshot drops, and nothing here renders it.
 */
function pinsOf(snapshot: MapSnapshot): CustomPinIcon[] {
  return (snapshot.pinIcons ?? []).map((pin) => ({
    id: pin.id,
    label: "",
    color: pin.color,
    glyph: pin.glyph ?? "",
    image: pin.image ?? "",
    // Left undefined rather than defaulted here: the design fields are optional
    // on `CustomPinIcon` too, and `resolvePin` is the one place that decides what
    // absent means. Filling them in twice is how the two would disagree.
    ring: pin.ring,
    ringWidth: pin.ringWidth,
    iconColor: pin.iconColor,
    size: pin.size,
    shape: pin.shape,
  }));
}

/**
 * A place's colour: its custom pin's own, or failing that its category's.
 *
 * A custom pin is a finished design and brings its colour with it, which is the
 * one case where the category does not decide. The same `??` runs in the editor
 * (components/map/use-place-markers.ts) — a map that coloured its pins one way in
 * the dashboard and another on the customer's site would be the worst kind of bug
 * to be told about.
 */
function colorOf(
  place: SnapshotPlace,
  colors: Map<string, string>,
  pins?: readonly CustomPinIcon[],
): string {
  return (
    resolvePin(place.icon, pins)?.color ??
    colors.get(place.category ?? "") ??
    UNCATEGORISED_PIN_COLOR
  );
}

/**
 * Every icon-and-colour combination the snapshot needs an image for.
 *
 * Built from the snapshot rather than from the currently-visible places: filters
 * only ever narrow that set, so registering once at load covers every pin the
 * visitor can reach without re-registering on each chip they press.
 */
function pinPairs(snapshot: MapSnapshot): { icon: string; color: string }[] {
  const colors = colorsOf(snapshot);
  const pins = pinsOf(snapshot);

  return snapshot.places
    .filter((place) => Boolean(place.icon))
    .map((place) => ({
      icon: place.icon as string,
      color: colorOf(place, colors, pins),
    }));
}

/**
 * Whether this place is drawn as a shaped pin rather than a dot.
 *
 * Asks the same question the feature builder does, by computing the same id.
 * Tested against the registered images rather than against the place's own
 * field, so a snapshot naming an icon this version of the embed doesn't ship —
 * or one that failed to rasterise — falls back to a dot everywhere at once.
 */
function pinIdFor(
  place: SnapshotPlace,
  colors: Map<string, string>,
  images: Set<string>,
  pins?: readonly CustomPinIcon[],
): string | null {
  if (!place.icon) return null;

  const id = pinImageId(place.icon, colorOf(place, colors, pins));
  return images.has(id) ? id : null;
}

/**
 * Feature properties are flat scalars — GeoJSON can't carry nested objects
 * through MapLibre's worker — so the place is stringified into one property and
 * parsed back when a pin is clicked.
 */
function toFeatureCollection(
  places: SnapshotPlace[],
  snapshot: MapSnapshot,
  images: Set<string>,
): GeoJSON.FeatureCollection {
  const colors = colorsOf(snapshot);
  const pins = pinsOf(snapshot);

  return {
    type: "FeatureCollection",
    features: places.map((place) => {
      const pin = pinIdFor(place, colors, images, pins);

      return {
        type: "Feature",
        geometry: { type: "Point", coordinates: [place.lng, place.lat] },
        properties: {
          color: colorOf(place, colors, pins),
          // Only when the image exists. `icon-image` naming a missing image is a
          // console warning per feature per frame on a customer's site, and the
          // pin would be invisible either way — a dot is the better failure.
          ...(pin ? { pin } : {}),
          place: JSON.stringify(place),
        },
      };
    }),
  };
}

function readPlace(feature: MapGeoJSONFeature): SnapshotPlace {
  return JSON.parse(String(feature.properties.place)) as SnapshotPlace;
}

function boundsOf(places: SnapshotPlace[]): LngLatBounds | null {
  if (places.length === 0) return null;

  const bounds = new LngLatBounds();
  for (const place of places) bounds.extend([place.lng, place.lat]);

  return bounds;
}

function fitBounds(map: MapLibreMap, bounds: MapSnapshot["bounds"]): void {
  if (!bounds) return;

  map.fitBounds(
    [
      [bounds.west, bounds.south],
      [bounds.east, bounds.north],
    ],
    { padding: FIT_PADDING, maxZoom: 15, animate: false },
  );
}
