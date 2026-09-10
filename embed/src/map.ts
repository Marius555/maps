import {
  FullscreenControl,
  GeolocateControl,
  LngLatBounds,
  Map as MapLibreMap,
  NavigationControl,
  Popup,
  ScaleControl,
  type GeoJSONSource,
  type LngLatLike,
  type MapGeoJSONFeature,
  type Point,
  type PointLike,
  type PositionAnchor,
  type StyleSpecification,
} from "maplibre-gl";

import {
  collapseAttribution,
  GEONAMES_ATTRIBUTION,
} from "@/packages/shared/attribution";
import {
  resolvePin,
  UNTAGGED_PIN_COLOR,
  type CustomPinIcon,
} from "@/packages/shared/pin-icons";
import {
  shapePolygon,
  strokeWidthOf,
  type AreaGeometry,
  type ShapeStrokeStyle,
} from "@/packages/shared/shapes";
import {
  defaultCardLayout,
  type CardLayout,
  type CardShadow,
} from "@/packages/shared/card-layout";
import type {
  MapSnapshot,
  SnapshotPlace,
  SnapshotShape,
  SnapshotTagGroup,
} from "@/packages/shared/snapshot";
import { pinColorOfTags, tagChipsOf } from "@/packages/shared/tags";

import { buildPopup, buildShapePopup } from "./popup";
import type { Fix } from "./search";
import type { Track } from "./track";
import {
  CARD_MARGIN,
  cardBands,
  chooseBand,
  PIN_ROOM,
  usableFrame,
  type UsableFrame,
} from "./card-place";
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
const SHAPE_DASHED_LINE_LAYER = "shape-dashed-outlines";
const SHAPE_DOTTED_LINE_LAYER = "shape-dotted-outlines";

/**
 * One line layer per marking, matching the editor's own table.
 *
 * A layer each rather than a data-driven `line-dasharray`, for the reason
 * components/map/shapes/shape-layers.ts spells out: a `case` puts every feature
 * in the layer through the SDF shader, solid ones included, and the editor draws
 * the same shape beside this bundle in its preview panel. The caps are not
 * interchangeable either — round closes a [2, 2] gap, and round on a zero-length
 * dash is the only way MapLibre draws a dot.
 *
 * Dashes are multiples of the line width, so both patterns scale with a shape's
 * own thickness.
 */
const OUTLINE_LAYERS: {
  id: string;
  stroke: ShapeStrokeStyle;
  cap: "round" | "butt";
  dash: [number, number] | null;
}[] = [
  { id: SHAPE_LINE_LAYER, stroke: "solid", cap: "round", dash: null },
  { id: SHAPE_DASHED_LINE_LAYER, stroke: "dashed", cap: "butt", dash: [2, 2] },
  { id: SHAPE_DOTTED_LINE_LAYER, stroke: "dotted", cap: "round", dash: [0, 2] },
];

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
 * Pins with no tags. Deliberately a neutral grey rather than the palette's first
 * colour — reusing that made an untagged place indistinguishable from the first
 * tag, and the filter row then explained a pin it did not cover.
 */


/**
 * Popup offsets, in pixels above the point.
 *
 * Two of them because there are two sizes. Both pins are balls centred on their
 * coordinate, so each offset is that ball's radius plus 6px of air. The icon
 * offset was 40 when the pin was a teardrop standing on its tip and every pixel
 * of it was *above* the point.
 */
const DOT_POPUP_OFFSET = 14;
const PIN_POPUP_OFFSET = 24;

/** No card is squeezed below this, however short the frame. */
const MIN_CARD_HEIGHT = 120;

/**
 * How far from a route a click still counts as on it.
 *
 * A line is drawn four pixels wide, and four pixels is not a target anybody hits
 * with a finger. MapLibre's own `map.on(type, layer)` tests the exact pointer
 * pixel, which is why the shape handlers below do their own querying.
 */
const TAP_SLOP = 6;

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
  /**
   * Where the map is looking, right now.
   *
   * The one read-only question in this handle, and the only one nothing inside
   * the embed asks. It is here for the dashboard's publish preview: that page
   * rebuilds the frame when a *structural* setting changes, and without a way to
   * carry the camera across, every press of a switch threw the owner back to the
   * map's saved default view. A few bytes against a control that reads as broken
   * — see components/preview/embed-preview.tsx.
   */
  getView: () => { lng: number; lat: number; zoom: number };
  /**
   * Remeasure and repaint.
   *
   * Also for the publish preview, and also because of how a browser treats a
   * frame nobody can see: a document that is not being rendered gets no
   * animation frames, so a map built in one comes up with a half-painted canvas
   * and — MapLibre drawing on demand rather than in a loop — stays that way once
   * it is revealed. The parent asks for this the moment it swaps a frame in.
   */
  resize: () => void;
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
  /**
   * Where the visitor is, for the Directions links on a card — asked each time a
   * card is built rather than taken as a value, because the browser's answer can
   * arrive long after the map is mounted.
   *
   * Deliberately not the results list's measuring origin, which a place picked
   * out of the search box also sets: routing somebody from a town they searched
   * for is the bug this exists to fix. See `me` in index.ts.
   */
  getMe?: () => Fix | null;
  /**
   * Told whenever the map's own geolocate control gets a position.
   *
   * Pressing that button is the plainest statement of "here I am" the map
   * offers — the visitor asked for it by name — and it used to be discarded
   * entirely, so a Directions link drawn one second later still had no
   * origin. `me` in index.ts keeps the sharpest reading of the session, so
   * this can only improve the answer or leave it alone.
   */
  onLocated?: (at: Fix) => void;
  /**
   * Where interactions are reported, or omitted for a map that reports nothing.
   *
   * Defaulted to a no-op below rather than tested at each call site: there are
   * six of them in this file, and `if (track)` six times is six chances to add
   * a seventh without one. See ./track.ts for why an unmeasured map costs a
   * function call and nothing else.
   */
  track?: Track;
};

export function createMap(
  container: HTMLElement,
  snapshot: MapSnapshot,
  {
    style,
    focusPlaceId = null,
    onSelect,
    getMe,
    onLocated,
    track = () => {},
  }: CreateMapOptions,
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

  /*
   * Which controls, and in which corner — the owner's, with absent meaning what
   * every published map already has: zoom and geolocate, top right, no compass.
   *
   * Adding `FullscreenControl` and `ScaleControl` here is close to free, and
   * that is a fact about the build rather than about them: `maplibre-gl` is
   * `external` in embed/vite.config.mts, so its dist files ship whole whether we
   * name these or not. What a switch costs is the line that reads it.
   *
   * `top-right` stays the fallback rather than becoming `top-left`, because a
   * snapshot published last year says nothing about corners and must keep
   * putting its zoom buttons where its owner last saw them (§7). The new
   * default reaches a map through DEFAULT_EMBED_SETTINGS, on their next publish.
   */
  const corner = snapshot.settings.controlsCorner ?? "top-right";

  map.addControl(
    new NavigationControl({ showCompass: snapshot.settings.compass === true }),
    corner,
  );

  if (snapshot.settings.geolocate !== false) {
    /*
     * High accuracy, and not MapLibre's default of `enableHighAccuracy:
     * false`, for one reason: the control draws an accuracy circle at the
     * radius the browser reports, and that circle is the visitor's only
     * picture of how well anything here knows where they are. Drawing the
     * cheapest answer while routing from the best one would make it a
     * picture of something else. **What they see as the circle is what a
     * Directions link starts from.**
     */
    const locate = new GeolocateControl({
      trackUserLocation: false,
      positionOptions: { enableHighAccuracy: true, maximumAge: 0 },
    });

    if (onLocated) {
      locate.on("geolocate", (event) => {
        onLocated({
          lat: event.coords.latitude,
          lng: event.coords.longitude,
          accuracy: event.coords.accuracy,
          timestamp: event.timestamp,
        });
      });
    }

    map.addControl(locate, corner);
  }

  if (snapshot.settings.fullscreen) {
    map.addControl(new FullscreenControl(), corner);
  }

  if (snapshot.settings.scale) {
    // Bottom-left whatever the stack does: a scale bar is a ruler read against
    // the map's edge, and stacking it under the zoom buttons puts a 100px bar in
    // the middle of the chrome.
    map.addControl(new ScaleControl({ maxWidth: 96 }), "bottom-left");
  }

  // No AttributionControl is added here on purpose: the `attributionControl`
  // map option above already creates one. Adding a second renders the credit
  // twice, stacked — a different doubling from the one described above, and
  // both were live at once. It is also the one control with no switch: the
  // credit is non-negotiable (§12).

  /*
   * ...and `compact: true` only makes it collapsible, not collapsed. MapLibre
   * renders it open until the visitor first touches the map, so on a customer's
   * page the credit lands as a full line of text. Started collapsed instead —
   * still present, still one click away. See packages/shared/attribution.ts.
   */
  map.on("load", () => collapseAttribution(map.getContainer()));
  map.on("styledata", () => collapseAttribution(map.getContainer()));

  /*
   * "This map has drawn something", for a parent document to wait on.
   *
   * Only the dashboard's publish preview reads it, and it is the difference
   * between a preview that blinks and one that does not. That page builds a
   * replacement document in a second iframe and swaps it to the front — but the
   * only signal it had was the iframe's own `load` event, which fires when this
   * module *starts*, not when it finishes: `mount()` still has a snapshot fetch
   * and a style fetch to await after it. So the swap revealed a blank white
   * document and the map arrived a beat later, which is exactly what "the map
   * disappears and reappears" was.
   *
   * On the map's own `load`, so it means the style is up and the first frame is
   * painted rather than merely that `createMap` returned. An attribute rather
   * than a method on the handle: the parent is polling for it, and an attribute
   * selector is something it can ask the DOM for directly.
   */
  map.on("load", () => {
    map.getContainer().closest(".lm-root")?.setAttribute("data-lm-ready", "1");

    /*
     * One view per map that actually drew.
     *
     * On `load` rather than at mount, and the difference is the whole meaning of
     * the number: `mount` fires when a lazily-mounted map scrolls into view, but
     * a map whose style or tiles never arrived also mounts. Counting here means
     * "views" is maps a visitor could see, not maps we started building.
     */
    track("view");
  });

  /*
   * A map on someone's landing page must not swallow the page scroll, so the
   * wheel needs ctrl or meta unless the owner has said otherwise — which they
   * would for a map that fills its own page, where the guard is just a map that
   * ignores the wheel.
   *
   * Absent is the guard, which is what every published map has.
   */
  if (snapshot.settings.scrollZoom !== true) {
    map.scrollZoom.disable();
    map.on("wheel", (event) => {
      if (event.originalEvent.ctrlKey || event.originalEvent.metaKey) {
        map.scrollZoom.enable();
        return;
      }
      map.scrollZoom.disable();
    });
  }

  const categories = new Map(
    // Legacy, read-only: a snapshot published before categories became tags.
    // Nothing writes this field any more (§7 keeps it readable forever).
    (snapshot.categories ?? []).map((category) => [category.id, category]),
  );
  const colors = colorsOf(snapshot);
  /*
   * The card's design, decided in the dashboard and baked into the snapshot.
   *
   * Absent means the owner never opened the designer, or the file predates it —
   * both of which have to keep drawing the card they always drew (§7). It is
   * already resolved and clamped by the time it is written, so nothing here
   * re-decides any of it.
   */
  const cardLayout = snapshot.cardLayout ?? defaultCardLayout();
  /*
   * The map's pins, for a card whose layout holds a Logo block. Resolved out
   * here rather than inside `map.on("load")` where the marker images are
   * registered, because `showPopup` below is in this scope and a second call is
   * one map of the same rows.
   */
  const cardPins = pinsOf(snapshot);
  /*
   * The map's tag vocabulary, for a card's Tags block.
   *
   * Out here beside `categories` and `cardPins` for the same reason: `showPopup`
   * runs on every pin click, and resolving a place's ids against sixty tags
   * inside it would walk the whole vocabulary each time. `tagChipsOf` returns
   * them in the *location's* own order, which is what makes the first chip the
   * colour the pin the visitor just clicked is wearing.
   */
  const cardTagGroups = snapshot.tagGroups ?? [];
  const popup = new Popup({
    closeButton: true,
    /*
     * **No cap here, because the card carries its own.**
     *
     * This was the owner's card width, on the reasonable-sounding argument that
     * MapLibre caps the popup itself and a wide card would otherwise be clipped
     * by the shell. What it missed is *which box* is capped: `.maplibregl-popup`
     * is a flex row of the tip **and** the content, so a 320px cap on it leaves
     * the content 310.4px — and `buildPopup` sets the card to 320px. Every card
     * therefore overflowed an `overflow: hidden` box by exactly the tip's width,
     * lost ~10px off its edge, and — the reported symptom — re-resolved its own
     * position inside that box on any repaint: hovering the gallery's arrow
     * moved the whole card, photo and icons included, 4px sideways.
     *
     * `none` lets the content box be the card's own width, which is where the
     * owner's design already lives (`root.style.width` in embed/src/popup.ts).
     * Nothing becomes unbounded: `.lm-popup` carries `max-width: 260px` in the
     * stylesheet, which is what still sizes a shape's popup on this same
     * instance.
     */
    maxWidth: "none",
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
    // Every route into a card converges here — pin, list row, shape, deep link,
    // and a filter evicting the open one — so this single line is the whole of
    // "which location did visitors look at". Instrumenting the four call sites
    // instead is how one of them ends up uncounted.
    if (id) track("open", { id });
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
    wireInteractions(map, (place) => showPopup(place), track);
    wireShapeInteractions(
      map,
      snapshot.shapes ?? [],
      (shape, at) => showShapePopup(shape, at),
      track,
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

    resetCard(popup);
    placeCard(map, popup);
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
          cardLayout,
          cardPins,
          tagChipsOf(cardTagGroups, place.tags),
          getMe?.() ?? null,
        ),
      )
      .addTo(map);

    // After `addTo`, which is when the shell element exists — the card's own
    // background, radius and padding live on MapLibre's container, not on ours.
    styleCard(popup, cardLayout);
    resetCard(popup);
    placeCard(map, popup);
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
      /*
       * The card first, then the flight — the reverse of what this was, and the
       * whole of why the card no longer jumps. `flyToCard` measures the card
       * that `showPopup` has just put on screen and folds the answer into the
       * camera move; with the flight started first there would be nothing to
       * measure and MapLibre would place the card itself, once per frame, all
       * the way there.
       */
      showPopup(place);
      flyToCard(map, popup, [place.lng, place.lat]);
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

    getView: () => {
      const center = map.getCenter();

      return { lng: center.lng, lat: center.lat, zoom: map.getZoom() };
    },

    resize: () => map.resize(),

    destroy: () => map.remove(),
  };
}

/**
 * The card's own shell — its padding, corners, border and shadow.
 *
 * These belong to `.maplibregl-popup-content`, which is MapLibre's element and
 * sits *above* ours, so they cannot be set on `.lm-popup` and inherited. Written
 * as custom properties on the popup container, where they cascade down to the
 * content box and the stylesheet picks them up.
 *
 * A colour left unset is left unset, never resolved to a literal here: absent
 * means "whatever surface this theme uses", which is the only way a card stays
 * readable when the visitor's map is dark. Writing `#ffffff` for a card the
 * owner never recoloured would break exactly that.
 */
function styleCard(popup: Popup, layout: CardLayout): void {
  const shell = popup.getElement();
  if (!shell) return;

  const set = (name: string, value: string | undefined) => {
    if (value === undefined) shell.style.removeProperty(name);
    else shell.style.setProperty(name, value);
  };

  set("--lm-card-pad", `${String(layout.padding)}px`);
  set("--lm-card-radius", `${String(layout.radius)}px`);
  set("--lm-card-gap", `${String(layout.gap)}px`);
  /*
   * The designed height, which `.lm-popup--place` takes as a real `height`.
   *
   * It is a *property* rather than an inline height on our own root because
   * `placeCard` clamps the card against the frame with `--lm-popup-max`, and
   * `max-height` beating `height` is the whole of how those two settle. The
   * shape popup deliberately never sees this — it is a name and a sentence, and
   * is meant to be the size of them.
   */
  set("--lm-card-h", `${String(layout.maxHeight)}px`);
  set("--lm-card-bg", layout.background);
  /*
   * A see-through card, in the two properties the stylesheet reads.
   *
   * A percent because it goes straight into a `color-mix`, exactly as
   * `--lm-panel-opacity` does; the whole `blur(...)` because the card's default
   * is `none` rather than `blur(0)` — a popup is created and destroyed per
   * click, and a backdrop root nobody asked for is not free. Both unset unless
   * the owner chose them, so a card designed before this existed writes
   * nothing and paints what it always painted.
   */
  set(
    "--lm-card-opacity",
    layout.backgroundOpacity === undefined
      ? undefined
      : `${String(layout.backgroundOpacity)}%`,
  );
  set(
    "--lm-card-backdrop",
    layout.backdropBlur ? `blur(${String(layout.backdropBlur)}px)` : undefined,
  );
  set(
    "--lm-card-border",
    layout.border && layout.borderWidth > 0
      ? `${String(layout.borderWidth)}px solid ${layout.border}`
      : undefined,
  );
  set("--lm-card-shadow", CARD_SHADOWS[layout.shadow]);
}

/**
 * Three shadows, and "none" is a real choice rather than a missing value.
 *
 * Undefined would fall back to MapLibre's own, which is the opposite of what an
 * owner who picked "none" asked for.
 */
const CARD_SHADOWS: Record<CardShadow, string> = {
  none: "none",
  soft: "0 1px 2px rgba(0, 0, 0, 0.1), 0 4px 12px rgba(0, 0, 0, 0.12)",
  strong: "0 2px 6px rgba(0, 0, 0, 0.16), 0 12px 32px rgba(0, 0, 0, 0.22)",
};

/**
 * A card is opening: forget the last one, and retire anything still deciding
 * about it.
 *
 * One `Popup` serves every pin and every shape on the map, so both halves of
 * this are about the card that was there a moment ago. `options.anchor` holds
 * `placeCard`'s verdict, and left alone it would open the next card beside the
 * next pin whatever room *that* one has — cleared rather than re-decided here,
 * because the decision needs a measurement and the card has no layout until the
 * next frame, and until then MapLibre's own guess is the better one to show.
 *
 * The counter is the other half, and it is what makes "the map moves once"
 * true. A placement pass waiting on `moveend` outlives the card it was measuring
 * for — click one pin and then another mid-flight and the first pass lands on
 * the second card, with a pin position it never looked at, and pans the map
 * somewhere neither click asked for. Every pass carries the number it started
 * on and gives up when it no longer matches.
 */
function resetCard(popup: Popup): void {
  popup.options.anchor = undefined;

  const card = popup.getElement();
  if (card) card.dataset.lmOpen = String(Number(card.dataset.lmOpen ?? 0) + 1);
}


/**
 * Where an open card goes, and what it costs to put it there.
 *
 * MapLibre picks a popup's side itself, and its rule is "above the point if the
 * card fits above, otherwise below" — which is the right answer right up to the
 * moment the card fits on *neither* side. Then it goes below, whatever is down
 * there, and hangs off the bottom of the map.
 *
 * That is the ordinary case for a location card rather than the edge one. A card
 * with a photo, a description, a week of opening hours and three extra fields is
 * taller than a good many of the frames it opens in — the Preview dialog, a
 * sidebar embed, a phone. Measured in the Preview dialog: a 430×436 frame, a
 * 320×289 card, and a pin dead in the middle of it because the map had just
 * flown there. 184px of room above, 184px below, and 181px either side: nowhere
 * for the card to go, and every choice a bad one.
 *
 * So this asks a different question. Not "which side does it fit on" but **"what
 * is the least the map has to move for it to fit somewhere"** — `cardBands`
 * above turns each of the four sides into the rectangle the pin would have to be
 * in, and the answer is the nearest point of the nearest of those rectangles. A
 * pin already inside one costs nothing and nothing moves, which is every pin on
 * a frame with room in it. The middle pin above costs a 105px pan, and shows the
 * whole card afterwards instead of two thirds of one.
 *
 * **The pan is safe here specifically because of the `isMoving` guard below.**
 * Panning was the first answer to this and was withdrawn as unreliable, for a
 * good reason: `focusPlace` opens its card the instant a flight starts, and a
 * pan issued mid-flight *interrupts* it — so the location the visitor asked for
 * never arrives. What makes it sound now is that nothing is measured, and so
 * nothing is panned, until the camera is at rest. It is the same guard the cap
 * always needed, doing a second job.
 *
 * A cap is still the last resort, for a frame too small for the card on any
 * side however the map moves. Whatever cannot be shown scrolls inside the card.
 *
 * `--lm-popup-max` is cleared before measuring so each pass sees the card's own
 * natural size rather than the cap the last one left — otherwise a card that was
 * once squeezed could never grow back when there was room. The anchor goes into
 * `popup.options`, which is a public field, and `setOffset` is what makes
 * MapLibre act on it: it is the one public method that re-runs the positioning
 * pass, and handing it back the offset it already has changes nothing else.
 *
 * Deferred a frame because the card is measured, and a node appended this tick
 * has no layout yet.
 */
function placeCard(map: MapLibreMap, popup: Popup): void {
  const card = popup.getElement();
  if (!card) return;

  /*
   * And again whenever the card changes size under the visitor.
   *
   * Opening "More details" adds a description, a week of hours and the field
   * rows to a card that was measured without them.
   *
   * Capture, because `toggle` does not bubble: the capture phase still visits
   * every ancestor on the way down to the <details> that fired it, which is what
   * lets one listener cover the fold and the hours inside it.
   *
   * Once per popup element. MapLibre reuses one container for every card it
   * shows, so subscribing on each open would stack a listener per pin clicked.
   */
  if (!card.dataset.lmFits) {
    card.dataset.lmFits = "1";
    card.addEventListener("toggle", () => placeCard(map, popup), true);
  }

  /*
   * Which card this pass is about. Everything below is deferred — a frame, or a
   * whole flight — and by the time it runs the popup may be showing somewhere
   * else entirely. See `resetCard`.
   */
  const open = card.dataset.lmOpen;

  requestAnimationFrame(() => {
    if (card.dataset.lmOpen !== open) return;

    /*
     * Never measure — and so never pan — against a camera that is still moving.
     *
     * `focusPlace` opens its card the instant the flight starts, and a popup is
     * anchored to a coordinate, so mid-flight the card is wherever that
     * coordinate currently projects to: for a hop between cities, tens of
     * thousands of pixels outside the frame. Waiting for the landing is also
     * what keeps the pan below from cutting the flight short — an `easeTo`
     * issued into a `flyTo` replaces it, and the location the visitor asked for
     * never arrives.
     *
     * **`moveend` is later than the map looks**, and measurably so: a flight's
     * target is the pin itself, so the pin reaches the middle of the frame and
     * stops while the zoom is still easing in behind it. Measured on the
     * Preview dialog, the card stopped moving 1.4s after the click and `moveend`
     * came at 3.8s. Nothing is lost in that gap — `resetCard` leaves
     * `options.anchor` unset, so MapLibre is placing the card by its own rule
     * throughout, which is exactly what it did before any of this existed — but
     * it is why the good placement can arrive as a visible settle rather than as
     * part of the flight.
     *
     * `isMoving` rather than `isEasing`, which the published `Map` type does not
     * expose. It is broader — a finger still on the map counts — and broader is
     * the right way to be wrong here: the worst case is measuring one `moveend`
     * later than strictly necessary.
     */
    if (map.isMoving()) {
      map.once("moveend", () => {
        if (card.dataset.lmOpen === open) placeCard(map, popup);
      });
      return;
    }

    const at = popup.getLngLat();
    if (!at) return;

    /*
     * Two boxes, and the difference between them matters. `card` is MapLibre's
     * container — our card plus its tip — and it is what has to fit inside the
     * frame. `content` is what a cap applies to. Capping the container's height
     * on the content would leave the chrome hanging over the edge by exactly the
     * chrome's own size.
     */
    const content = card.querySelector<HTMLElement>(".lm-popup");
    if (!content) return;

    card.style.removeProperty("--lm-popup-max");

    const usable = usableFrame(map.getContainer());
    const point = map.project(at);
    /*
     * Numeric by construction — `showPopup` sets one of the two pin radii and
     * `showShapePopup` sets zero — but the option's type also allows a Point and
     * a per-anchor table, neither of which has one number to subtract.
     */
    const gap =
      typeof popup.options.offset === "number" ? popup.options.offset : 0;

    const height = card.offsetHeight;
    const bands = cardBands(card.offsetWidth, height, usable, gap);

    const best = chooseBand(bands, point.x, point.y);

    /*
     * No band at all: the usable rect is smaller than the card on every side, so
     * there is nothing to move towards and the card is capped instead.
     */
    if (!best) {
      capCard(popup, card, content, height, usable, point.y, gap);
      return;
    }

    setAnchor(popup, best.anchor);

    /*
     * Under a pixel is where the pin already is, which is every pin on a frame
     * with room in it. Panning by a rounding error is an animation the visitor
     * can see for no reason.
     */
    if (best.move < 1) return;

    /*
     * One pan, and nothing listens for it to finish.
     *
     * The pin lands inside a band, and a band is the set of positions the whole
     * card fits from — so there is nothing left to decide when the map stops,
     * and re-entering here would be a second question with a second chance of
     * moving the map again. `dev.html` says this out loud, because "the map
     * settles somewhere sensible eventually" and "the map moves once" look the
     * same in a screenshot and nothing like each other to watch.
     *
     * `panBy` is stated as an offset applied to the map rather than to what is
     * drawn on it, so its sign is the opposite of the pin's own travel: to move
     * the pin *down* the frame, the map goes up.
     */
    map.panBy([point.x - best.x, point.y - best.y]);
  });
}


/**
 * Fly to a pin whose card is already open, and land with the card in place.
 *
 * **The bug this exists for.** `resetCard` clears `popup.options.anchor` on
 * every open and `placeCard` refuses to measure while the camera is moving, so
 * for the whole length of a flight MapLibre applied its own rule — *above the
 * point if the card fits above, otherwise below* — re-evaluated every frame as
 * the pin travelled across the frame. On a tall card that is bottom, then a
 * side, then bottom again: the card visibly jumping around its own pin for the
 * length of the animation, and then one more settle when `placeCard` finally
 * measured at `moveend` and panned. Two moves and a flicker for one click.
 *
 * So the question is asked **before** the flight rather than after it. The
 * destination is known — a `flyTo` with a `center` puts that coordinate in the
 * middle of the frame — so the bands can be evaluated against the frame's own
 * centre, the anchor fixed before MapLibre gets to guess, and the difference
 * handed to `flyTo` as an `offset`, which is stated as where the target centre
 * sits relative to the container centre when the animation ends. The pin
 * therefore arrives already inside the band its card needs, in one motion, with
 * nothing left to settle.
 *
 * **Measured synchronously**, which is the one thing here that looks wrong and
 * is not: `offsetWidth` forces a reflow, so a popup appended this tick does have
 * a box by the time it is read. It costs one layout per click. `placeCard`'s own
 * pass defers a frame instead because it also runs from a `toggle` deep inside
 * the card, where the thing that changed size has not been styled yet.
 *
 * **No band at all** — a frame smaller than the card whichever side it opens on
 * — is not a zoom question either, though it looks like one. Nothing about
 * zooming changes whether a 440px card fits a 257px frame. There the pin is put
 * near the bottom of the frame instead, so the card is cut against everything
 * above it rather than against half of it, and the cap takes the rest.
 */
function flyToCard(
  map: MapLibreMap,
  popup: Popup,
  center: [number, number],
): void {
  const zoom = Math.max(map.getZoom(), FOCUS_ZOOM);
  const card = popup.getElement();

  if (!card) {
    map.flyTo({ center, zoom });
    return;
  }

  /*
   * The cap the *last* card was given, cleared before this one is measured.
   *
   * One `Popup` serves every pin on the map, so the container arrives carrying
   * whatever the previous card was squeezed to — and measuring against that
   * would decide this card's side from a height that is not its own. Same line,
   * and the same reason, as `placeCard`.
   */
  card.style.removeProperty("--lm-popup-max");

  const frame = map.getContainer();
  const usable = usableFrame(frame);
  /* Numeric by construction — `showPopup` sets one of the two pin radii. See
     `placeCard`, which reads it the same way. */
  const gap = typeof popup.options.offset === "number" ? popup.options.offset : 0;

  /*
   * Where the pin lands with no offset, which is what a plain `flyTo` does.
   *
   * The **container's** centre and deliberately not the usable rect's: MapLibre
   * defines `offset` as where the target sits relative to the centre of the map
   * container, so a floating results panel changes where the card may go and
   * changes nothing at all about this number. Mixing the two is how the camera
   * would fly the panel's width too far.
   */
  const middleX = frame.clientWidth / 2;
  const middleY = frame.clientHeight / 2;

  const best = chooseBand(
    cardBands(card.offsetWidth, card.offsetHeight, usable, gap),
    middleX,
    middleY,
  );

  if (!best) {
    /*
     * Nowhere for the card to go, so the card gives way rather than the camera —
     * but the side it opens on is still decided **here**, before the flight.
     *
     * That is the whole point of this branch and the first version got it wrong
     * by simply flying: with `options.anchor` left unset MapLibre placed the
     * card itself, once per frame, and a tall card in a short frame is exactly
     * the case where its rule keeps changing its mind. Measured on a 558x257
     * frame with a 440px card: four anchors in one flight — left, top-left, top,
     * bottom — which is the jumping this function exists to stop, in the shape
     * most likely to provoke it.
     *
     * **The pin lands low rather than in the middle**, and that is two things at
     * once. It is the better answer — a card that has to be cut short is cut
     * against the whole frame above the pin instead of against half of it,
     * which on that 558x257 frame is 120px of card against 217px. And it is
     * what makes the choice *stable*: a centred pin leaves `above` and `below`
     * equal to within a rounding error, so `placeCard`'s own pass at `moveend`
     * would toss a coin on the same question and flip the card once more at the
     * end of the flight. Measured before this line: exactly that, one flip in
     * three flights.
     *
     * Capped here too, so the card is its final size before the camera moves,
     * and `placeCard` re-measuring at rest reaches this same function with the
     * same numbers — so it re-applies the same cap and `setAnchor` finds nothing
     * to change.
     */
    const content = card.querySelector<HTMLElement>(".lm-popup");
    const targetY = usable.bottom - CARD_MARGIN - PIN_ROOM;

    if (content) {
      capCard(popup, card, content, card.offsetHeight, usable, targetY, gap);
    }

    /*
     * **Still zoomed**, which is the one thing in this function that was tried
     * the other way and put back.
     *
     * "Don't zoom in so far when there is no room for the card" sounds like the
     * fix and is not: zooming changes nothing about whether a 440px card fits a
     * 257px frame. The room is bought by the offset above and, when there is
     * none to buy, by the cap — and holding the camera at the zoom it happened
     * to be at costs a real thing, because a phone is the frame that reaches
     * this branch most often. A visitor tapping a shop in the list there would
     * arrive at whatever the map was showing before, which is the whole of what
     * tapping a row is for.
     */
    map.flyTo({ center, zoom, offset: [0, targetY - middleY] });
    return;
  }

  setAnchor(popup, best.anchor);
  map.flyTo({
    center,
    zoom,
    offset: [best.x - middleX, best.y - middleY],
  });
}

/**
 * The last resort: a card taller than any side of the frame, cut to fit.
 *
 * The roomier of above and below, since a card that has to be cut short should
 * at least be cut as little as possible. Whatever does not fit scrolls inside
 * the card.
 *
 * The cap lands on the *content* and is worked out from the container, which is
 * the difference the two boxes exist for: `full` is our card plus MapLibre's
 * tip, and capping the container's height on the content would leave the chrome
 * hanging over the edge by exactly the chrome's own size.
 *
 * Its own function because the settle and the flight both reach this case, and
 * a second copy is how the two would come to cut the same card to two different
 * heights.
 */
function capCard(
  popup: Popup,
  card: HTMLElement,
  content: HTMLElement,
  /** The container's height, tip included. */
  full: number,
  usable: UsableFrame,
  pointY: number,
  gap: number,
): void {
  const above = pointY - usable.top - gap - CARD_MARGIN;
  const below = usable.bottom - pointY - gap - CARD_MARGIN;

  setAnchor(popup, above >= below ? "bottom" : "top");
  card.style.setProperty(
    "--lm-popup-max",
    `${String(
      Math.max(
        Math.max(above, below) - (full - content.getBoundingClientRect().height),
        MIN_CARD_HEIGHT,
      ),
    )}px`,
  );
}

/**
 * Which side the card opens on, told to MapLibre.
 *
 * `setOffset` is the lever rather than the message: it is the one public method
 * that re-runs the positioning pass, and the offset it is handed is the one it
 * already had. Skipped when nothing changed, so a card that is merely being
 * re-measured does not repaint its own position.
 */
function setAnchor(popup: Popup, anchor: PositionAnchor): void {
  if (popup.options.anchor === anchor) return;

  popup.options.anchor = anchor;
  popup.setOffset(popup.options.offset);
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
          // Both absent on every snapshot published before these existed, which
          // is what makes those maps draw exactly as they always have.
          width: strokeWidthOf(shape.kind === "line", shape.strokeWidth),
          stroke: shape.strokeStyle ?? "solid",
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

  for (const outline of OUTLINE_LAYERS) {
    map.addLayer({
      id: outline.id,
      type: "line",
      source: SHAPE_SOURCE_ID,
      filter: ["==", ["get", "stroke"], outline.stroke],
      layout: { "line-join": "round", "line-cap": outline.cap },
      paint: {
        "line-color": ["get", "color"],
        // Full opacity whatever the fill is set to: a shape at 5% fill still has
        // to be findable, and its edge is what makes it so.
        "line-opacity": 1,
        // Already resolved per feature — a line is the whole object rather than
        // an area's edge, so it defaults heavier, and with no fill behind it a
        // hairline is also a thing a visitor cannot reliably tap.
        "line-width": ["get", "width"],
        ...(outline.dash ? { "line-dasharray": outline.dash } : {}),
      },
    });
  }
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
 * Clicking an area — or a route — opens its card.
 *
 * **A pin inside a shape belongs to the pin, and that has to be said out loud
 * here.** MapLibre's `map.on(type, layer, fn)` is a thin wrapper: each
 * registration adds its own `click` listener that runs its own
 * `queryRenderedFeatures` scoped to its own layer, and they fire in
 * registration order with no arbitration between them. There is no "topmost
 * layer wins". So a click on a pin standing on a delivery radius ran the pin's
 * handler and then the shape's, and the shape's replaced the card with the
 * region's — the card jumped off the pin, the list row de-selected, and the
 * location was unopenable for as long as it stood inside a shape.
 *
 * Which is why this listens to the map rather than to a layer, and decides for
 * itself: pins first, then the shapes in an order it chooses. A guard bolted
 * onto per-layer listeners would work too and would come undone the next time
 * somebody reordered the registrations in `load`.
 *
 * Routes could not be clicked at all before this. `SHAPE_FILL_LAYER` is filtered
 * to polygons, nothing listened on the outline layer, and a `kind: "line"` shape
 * therefore rendered, invited a click with its pointer cursor, and did nothing.
 */
function wireShapeInteractions(
  map: MapLibreMap,
  shapes: SnapshotShape[],
  /**
   * Takes where the visitor clicked, not the shape's centre: on a region
   * spanning the viewport, a card anchored to the middle can be off screen.
   */
  onSelect: (shape: SnapshotShape, at: LngLatLike) => void,
  track: Track,
): void {
  if (shapes.length === 0) return;

  const byId = new Map(shapes.map((shape) => [shape.id, shape]));

  const shapeAt = (point: Point): SnapshotShape | null => {
    if (hitsAPlace(map, point)) return null;

    const found = (
      layers: string[],
      at: PointLike | [PointLike, PointLike],
    ) =>
      idsAt(map, layers, at)
        .map((id) => byId.get(id))
        .filter((shape): shape is SnapshotShape => shape !== undefined);

    /*
     * The outline layers first, and with room around the pointer. They draw
     * every route a handful of pixels wide, which is not a target a finger can
     * hit — and they also draw every area's edge, so this is what makes clicking
     * a region's border open that region.
     *
     * All three, because a marking must not decide whether the thing wearing it
     * can be tapped: a dotted route is mostly gaps, and `queryRenderedFeatures`
     * tests the line's geometry rather than its dashes, so a gap still hits.
     *
     * A route wins over an edge it happens to cross. Both can be in the box, and
     * of the two the route is the smaller and more deliberate aim: an area can
     * be opened from anywhere in its fill, and a route has only its own width.
     */
    const outlines = found(
      OUTLINE_LAYERS.map((outline) => outline.id),
      boxAround(point),
    );
    const route = outlines.find((shape) => shape.kind === "line");

    return route ?? outlines[0] ?? found([SHAPE_FILL_LAYER], point)[0] ?? null;
  };

  map.on("click", (event) => {
    const shape = shapeAt(event.point);
    if (!shape) return;

    track("shape", { id: shape.id });
    onSelect(shape, event.lngLat);
  });

  map.on("mousemove", (event) => {
    // Whatever `wireInteractions` set for a pin wins: it runs its own mousemove
    // and this one only ever writes when it has something of its own to say.
    if (shapeAt(event.point)) map.getCanvas().style.cursor = "pointer";
  });
}

/** A square of forgiveness around the pointer, for the layers that need it. */
function boxAround(point: Point): [PointLike, PointLike] {
  return [
    [point.x - TAP_SLOP, point.y - TAP_SLOP],
    [point.x + TAP_SLOP, point.y + TAP_SLOP],
  ];
}

/**
 * The shape ids drawn at a point, across the given layers.
 *
 * Filtered to the layers that exist, because a map with no shapes adds none of
 * them and `queryRenderedFeatures` throws for a layer that is not there — the
 * same guard MapLibre's own delegated listeners apply.
 */
function idsAt(
  map: MapLibreMap,
  layerIds: string[],
  at: PointLike | [PointLike, PointLike],
): string[] {
  const layers = layerIds.filter((layer) => map.getLayer(layer));
  if (layers.length === 0) return [];

  return map
    .queryRenderedFeatures(at, { layers })
    .map((feature) => feature.properties?.id)
    .filter((id): id is string => typeof id === "string");
}

/**
 * Whether one of the map's own locations is under this point.
 *
 * Filtered to layers that exist, because clustering is optional and a style
 * without the layer makes `queryRenderedFeatures` throw rather than return
 * nothing — the same filtering MapLibre's own delegated listeners do.
 */
function hitsAPlace(map: MapLibreMap, point: PointLike): boolean {
  const layers = [POINT_LAYER, PIN_LAYER, CLUSTER_LAYER].filter((layer) =>
    map.getLayer(layer),
  );

  if (layers.length === 0) return false;

  return map.queryRenderedFeatures(point, { layers }).length > 0;
}

function wireInteractions(
  map: MapLibreMap,
  onSelect: (place: SnapshotPlace) => void,
  track: Track,
): void {
  for (const layer of [POINT_LAYER, PIN_LAYER]) {
    map.on("click", layer, (event) => {
      const feature = event.features?.[0];
      if (!feature) return;

      const place = readPlace(feature);
      /*
       * Reported beside `open`, not instead of it.
       *
       * `setOpen` counts every card that opened however it was reached; this
       * counts the ones reached by clicking the map itself. Both are wanted —
       * the first is "which location do people look at", the second is "do they
       * use the map or the list", and a customer whose visitors never touch the
       * map should probably publish a taller panel.
       */
      track("pin", { id: place.id });
      onSelect(place);
    });
  }

  map.on("click", CLUSTER_LAYER, (event) => {
    const feature = event.features?.[0];
    if (!feature) return;

    // No id: a cluster is a number the map invented at this zoom, and it names
    // nothing that survives the next one.
    track("cluster");

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

/**
 * Everything a pin's colour can come from, resolved once per render pass.
 *
 * Two vocabularies, because a published snapshot is read forever (§7). Tags are
 * what a map published today carries; `categories` is what one published before
 * they merged carries, and it is read here and nowhere else in the embed. A file
 * has one or the other, never both, so the order below never has to arbitrate.
 */
export type PinColors = {
  tagGroups: SnapshotTagGroup[];
  /** Legacy, read-only: category id → hex, for pre-merge snapshots. */
  categories: Map<string, string>;
  /**
   * What an untagged place is drawn in, when the owner has published an answer.
   *
   * Absent on every snapshot written before the field existed, which is why the
   * grey below is still the last word rather than this.
   */
  pin?: string;
};

export function colorsOf(snapshot: MapSnapshot): PinColors {
  return {
    tagGroups: snapshot.tagGroups ?? [],
    categories: new Map(
      (snapshot.categories ?? []).map((category) => [
        category.id,
        category.color,
      ]),
    ),
    pin: snapshot.settings.pinColor,
  };
}

/**
 * The map's own pins, in the shape the shared resolver reads.
 *
 * Widened rather than reimplemented: `resolvePin` is what the dashboard's markers
 * and drag ghost go through too, and a second lookup here is how the pin a
 * customer arranged and the pin their visitors get quietly stop matching. The
 * label is the one field the snapshot drops, and nothing here renders it.
 */
export function pinsOf(snapshot: MapSnapshot): CustomPinIcon[] {
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
 * A place's colour: its custom pin's own, or failing that its first tag's.
 *
 * A custom pin is a finished design and brings its colour with it, which is the
 * one case where a tag does not decide. The same `??` runs in the editor
 * (components/map/use-place-markers.ts) — a map that coloured its pins one way in
 * the dashboard and another on the customer's site would be the worst kind of bug
 * to be told about.
 *
 * The category lookup underneath is the whole of the embed's back-compatibility
 * with pre-merge snapshots, and it is deliberately *below* the tags rather than
 * beside them: a file carries one vocabulary or the other, so on an old snapshot
 * `pinColorOfTags` finds nothing and this answers, and on a new one it never
 * runs. Deleting it would turn every already-published map grey.
 *
 * `colors.pin` is the owner's own answer for a place that has none of the above,
 * and it is second to last for the same reason the categories are third: it must
 * not out-rank anything the map actually says about a place. `UNTAGGED_PIN_COLOR`
 * stays under it because a snapshot published before the field carries no answer,
 * and grey is what it drew.
 */
export function colorOf(
  place: SnapshotPlace,
  colors: PinColors,
  pins?: readonly CustomPinIcon[],
): string {
  return (
    resolvePin(place.icon, pins)?.color ??
    pinColorOfTags(colors.tagGroups, place.tags) ??
    colors.categories.get(place.category ?? "") ??
    colors.pin ??
    UNTAGGED_PIN_COLOR
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
  colors: PinColors,
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
