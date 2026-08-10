import {
  GeolocateControl,
  LngLatBounds,
  Map as MapLibreMap,
  NavigationControl,
  Popup,
  type GeoJSONSource,
  type MapGeoJSONFeature,
  type StyleSpecification,
} from "maplibre-gl";

import { collapseAttribution } from "@/packages/shared/attribution";
import type { MapSnapshot, SnapshotPlace } from "@/packages/shared/snapshot";

import { buildPopup } from "./popup";

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
 */

const SOURCE_ID = "places";
const CLUSTER_LAYER = "clusters";
const CLUSTER_COUNT_LAYER = "cluster-count";
const POINT_LAYER = "place-points";

/** Past this zoom, show individual pins rather than bubbles. */
const CLUSTER_MAX_ZOOM = 14;
const CLUSTER_RADIUS = 50;
const FIT_PADDING = 48;
const FOCUS_ZOOM = 15;

/**
 * Pins with no category. Deliberately a neutral grey rather than the palette's
 * first colour — reusing that made an uncategorised place indistinguishable
 * from the first category, and the legend then explained a pin it didn't cover.
 */
const UNCATEGORISED_COLOR = "#7a828f";

export type MapHandle = {
  setPlaces: (places: SnapshotPlace[]) => void;
  focusPlace: (place: SnapshotPlace) => void;
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
};

export function createMap(
  container: HTMLElement,
  snapshot: MapSnapshot,
  { style, focusPlaceId = null }: CreateMapOptions,
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
     * No `customAttribution`: the tile source's own TileJSON already credits
     * OpenFreeMap, OpenMapTiles and OpenStreetMap. Passing `snapshot.attribution`
     * as well printed all three a second time, joined by a pipe — that was the
     * doubled line. `snapshot.attribution` stays in the contract because
     * snapshots are immutable, it is just no longer the thing that renders it.
     */
    attributionControl: { compact: true },
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
  const popup = new Popup({ closeButton: true, maxWidth: "280px", offset: 14 });

  let places = snapshot.places;
  /** Which place the open popup belongs to, so filtering can close a stale one. */
  let openPlaceId: string | null = null;

  popup.on("close", () => {
    openPlaceId = null;
  });

  map.on("load", () => {
    map.addSource(SOURCE_ID, {
      type: "geojson",
      data: toFeatureCollection(places, snapshot),
      cluster: snapshot.settings.clustering,
      clusterMaxZoom: CLUSTER_MAX_ZOOM,
      clusterRadius: CLUSTER_RADIUS,
    });

    addLayers(map, snapshot);
    wireInteractions(map, (place) => showPopup(place));

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

  const showPopup = (place: SnapshotPlace) => {
    openPlaceId = place.id;
    popup
      .setLngLat([place.lng, place.lat])
      .setDOMContent(buildPopup(place, categories.get(place.category ?? "")))
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

      source.setData(toFeatureCollection(next, snapshot));

      // A popup left open over a pin that has just been filtered away is a card
      // floating on empty map, with a Directions link to somewhere no longer
      // shown.
      if (openPlaceId && !next.some((place) => place.id === openPlaceId)) {
        popup.remove();
        openPlaceId = null;
      }
    },

    focusPlace: (place) => {
      map.flyTo({
        center: [place.lng, place.lat],
        zoom: Math.max(map.getZoom(), FOCUS_ZOOM),
      });

      showPopup(place);
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
    filter: ["!", ["has", "point_count"]],
    paint: {
      // Precomputed per feature, so no match expression has to be rebuilt when
      // categories change.
      "circle-color": ["get", "color"],
      "circle-radius": 8,
      "circle-stroke-width": 2,
      "circle-stroke-color": "#ffffff",
    },
  });
}

function wireInteractions(
  map: MapLibreMap,
  onSelect: (place: SnapshotPlace) => void,
): void {
  map.on("click", POINT_LAYER, (event) => {
    const feature = event.features?.[0];
    if (!feature) return;

    onSelect(readPlace(feature));
  });

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

  for (const layer of [POINT_LAYER, CLUSTER_LAYER]) {
    map.on("mouseenter", layer, () => {
      map.getCanvas().style.cursor = "pointer";
    });
    map.on("mouseleave", layer, () => {
      map.getCanvas().style.cursor = "";
    });
  }
}

/**
 * Feature properties are flat scalars — GeoJSON can't carry nested objects
 * through MapLibre's worker — so the place is stringified into one property and
 * parsed back when a pin is clicked.
 */
function toFeatureCollection(
  places: SnapshotPlace[],
  snapshot: MapSnapshot,
): GeoJSON.FeatureCollection {
  const colors = new Map(
    snapshot.categories.map((category) => [category.id, category.color]),
  );

  return {
    type: "FeatureCollection",
    features: places.map((place) => ({
      type: "Feature",
      geometry: { type: "Point", coordinates: [place.lng, place.lat] },
      properties: {
        color: colors.get(place.category ?? "") ?? UNCATEGORISED_COLOR,
        place: JSON.stringify(place),
      },
    })),
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
