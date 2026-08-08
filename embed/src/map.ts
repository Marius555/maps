import {
  GeolocateControl,
  LngLatBounds,
  Map as MapLibreMap,
  NavigationControl,
  Popup,
  type GeoJSONSource,
  type MapGeoJSONFeature,
} from "maplibre-gl";

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

export function createMap(
  container: HTMLElement,
  snapshot: MapSnapshot,
): MapHandle {
  const map = new MapLibreMap({
    container,
    style: snapshot.styleUrl,
    center: [snapshot.center.lng, snapshot.center.lat],
    zoom: snapshot.center.zoom,
    // Attribution for OpenStreetMap and the tile provider is non-negotiable on
    // every rendered map, the embed included (CLAUDE.md §12).
    attributionControl: { compact: false, customAttribution: snapshot.attribution },
  });

  map.addControl(new NavigationControl({ showCompass: false }), "top-right");
  map.addControl(
    new GeolocateControl({ trackUserLocation: false }),
    "top-right",
  );
  // No AttributionControl is added here on purpose: the `attributionControl`
  // map option above already creates one. Adding a second renders the credit
  // twice, stacked.

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

    if (snapshot.bounds) fitBounds(map, snapshot.bounds);
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
