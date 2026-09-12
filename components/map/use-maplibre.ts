"use client";

// MapLibre v6 is ESM with named exports — there is no default export.
import {
  Map as MapLibreMap,
  NavigationControl,
  type StyleSpecification,
} from "maplibre-gl";
import { useEffect, useMemo, useRef, useState } from "react";

import { effectiveAppearance } from "@/lib/map/appearance";
import { carryRuntimeLayers } from "@/lib/map/carry-style";
import { resolveStyleUrl, type MapStyleKey } from "@/lib/map/style";
import { collapseAttribution } from "@/packages/shared/attribution";
import { loadMapStyle } from "@/packages/shared/load-style";
import type { MapAppearance } from "@/packages/shared/map-appearance";
import type { ShapeBounds } from "@/packages/shared/shapes";
import { usePrefersDark } from "@/lib/theme/use-prefers-dark";

type Options = {
  center: { lng: number; lat: number };
  zoom: number;
  /**
   * Open framed on this box instead of on `center`/`zoom`.
   *
   * Read once at construction like the two it overrides, and handed to
   * MapLibre's own constructor rather than applied afterwards — that is the
   * whole point of it. A map built at one view and then moved to another
   * downloads two complete tile pyramids: everything at the view it was born
   * with, then everything again at the view it wanted. Framing at construction
   * makes the first tile request the right one.
   */
  bounds?: ShapeBounds | null;
  /**
   * How far `bounds` may zoom in when the box is small.
   *
   * 14 is the editor's answer and stays the default, so nothing that does not
   * pass this moves. The Analytics heatmap overrides it because its two layers
   * cross-fade at a fixed zoom: a handful of locations a kilometre apart frame
   * to zoom 13, which is past the fade, so the page would open showing dots and
   * never draw the density map it exists for.
   */
  maxFitZoom?: number;
  style: MapStyleKey;
  /**
   * Whether the zoom stack carries a compass as well as the two zoom buttons.
   *
   * The one thing that varies, and off by default, because three of the four
   * maps built on this hook are small — the pin field in the Edit location form
   * is 160px tall, and a third button is clutter on it. The editor's canvas asks
   * for it; the review map, the pin field and the Analytics heatmap do not.
   *
   * There is deliberately nothing else here. Locate, fullscreen and the scale
   * ruler were all offered for a while and are all gone: on the dashboard they
   * are furniture over a map the owner is *editing*, and the corner they stacked
   * in is worth more than they are. The **embed** still offers all of them,
   * because there the visitor is only looking — see `SnapshotSettings` and
   * `components/publish/design-sidebar/map-controls-group.tsx`, which is where
   * that choice belongs.
   */
  showCompass?: boolean;
  /**
   * The map's stored `appearance` blob, straight off the row. Normalised here
   * rather than by each caller so a map with nothing stored, a map created
   * before the column existed and a map whose JSON was hand-edited all mean the
   * same thing.
   */
  appearance?: Record<string, unknown>;
};

/**
 * Owns one MapLibre instance for the lifetime of the container.
 *
 * Takes two elements. `frame` is the box the layout resizes — the one observed —
 * and `container` is what MapLibre is given, absolutely positioned inside it. The
 * split is what lets the frame own the layout and the placeholder background
 * while the map owns everything painted over it.
 *
 * StrictMode double-invokes effects in development, so create and destroy must
 * be symmetric — otherwise you get two canvases and a leaked WebGL context.
 */
export function useMaplibre(
  frame: React.RefObject<HTMLDivElement | null>,
  container: React.RefObject<HTMLDivElement | null>,
  options: Options,
) {
  const mapRef = useRef<MapLibreMap | null>(null);
  const [isReady, setIsReady] = useState(false);

  /*
   * `auto` resolves here so no caller has to know it exists — they pass whatever
   * the map is set to and get the right basemap either way.
   *
   * Read synchronously off <html>, which the pre-paint script has already set,
   * because this value is needed at construction. See lib/theme/use-prefers-dark.
   */
  const prefersDark = usePrefersDark();
  const styleUrl = resolveStyleUrl(options.style);

  /*
   * Memoised because it is what the restyle effect below depends on, and an
   * object rebuilt on every render would restyle the canvas on every render. The
   * inputs are all stable: `options.appearance` comes off the query cache and
   * only changes identity when the stored blob does.
   */
  const mapStyle = options.style;
  const stored = options.appearance;
  const appearance = useMemo(
    () => effectiveAppearance(mapStyle, stored, prefersDark),
    [mapStyle, stored, prefersDark],
  );

  // Read once at creation. Changing the initial view later would yank the map
  // out from under someone mid-pan.
  const initial = useRef({ ...options, styleUrl, appearance });

  /*
   * What the canvas is currently showing, so the restyle effect below can tell a
   * real change from a re-render.
   *
   * A string rather than the object: the object is rebuilt whenever any of its
   * inputs change, and comparing by identity would restyle on a change that
   * produced the same map. Seeded from the same values as `initial` rather than
   * read off it — a ref's `.current` must not be touched during render, and on
   * the first render these are the same values anyway.
   */
  const look = lookKey(styleUrl, appearance);
  const applied = useRef(look);

  useEffect(() => {
    const element = container.current;
    const box = frame.current;
    if (!element || !box || mapRef.current) return;

    let map: MapLibreMap | null = null;
    let observer: ResizeObserver | null = null;
    let cancelled = false;

    void (async () => {
      /*
       * A URL when there is nothing to change, so MapLibre fetches it itself
       * exactly as before; the transformed style object otherwise. Only the
       * second case is a promise, and awaiting a plain string costs one
       * microtask.
       */
      let style: string | StyleSpecification;

      try {
        style = (await loadMapStyle(
          initial.current.styleUrl,
          initial.current.appearance,
        )) as string | StyleSpecification;
      } catch (error) {
        /*
         * A working plain map beats no map: the theme is a nicety, the basemap
         * is not.
         *
         * Recording it as "nothing applied" leaves the restyle effect below with
         * a mismatch it will act on once the map is ready, so a transient
         * network blip heals itself. It cannot loop — that effect writes
         * `applied` before its own await, so a second failure is the last.
         */
        console.error("[maplibre]", error);
        style = initial.current.styleUrl;
        applied.current = lookKey(initial.current.styleUrl, null);
      }

      if (cancelled) return;

      /*
       * MapLibre applies `bounds` after `center`/`zoom` and calls `resize()`
       * itself before fitting, so passing both is not a conflict: the box wins
       * when there is one, and the pair is what a map with a saved view opens
       * on. See the note on `Options.bounds` for why this is not a `fitBounds`
       * once the map is up.
       */
      const opening = initial.current.bounds;
      // Read once with the rest of the opening view. See `Options.maxFitZoom`.
      const maxFitZoom = initial.current.maxFitZoom ?? DEFAULT_MAX_FIT_ZOOM;

      map = new MapLibreMap({
        container: element,
        style,
        center: [initial.current.center.lng, initial.current.center.lat],
        zoom: initial.current.zoom,
        ...(opening
          ? {
              bounds: [
                [opening.west, opening.south],
                [opening.east, opening.north],
              ] as [[number, number], [number, number]],
              // A single pin is a zero-area box and would otherwise open at
              // maximum zoom — the same guard the imperative fit carries.
              fitBoundsOptions: { padding: 48, maxZoom: maxFitZoom, duration: 0 },
            }
          : {}),
        // MapLibre defaults antialias to false, which leaves every road casing,
        // building edge and diagonal label looking jagged. Vector basemaps are
        // almost all diagonal geometry, so this is the single biggest visual win
        // available and costs one MSAA pass on hardware that already has it.
        canvasContextAttributes: { antialias: true },
        /*
         * We drive resizing ourselves — see the ResizeObserver below.
         *
         * MapLibre's own observer is not a duplicate of ours, it is an obstacle
         * to it: it re-centres the map behind our back on its own 50ms throttle,
         * so by the time our handler runs the transform already describes the new
         * size and the measurement it needs to compensate against is gone. With
         * this left at its default, no amount of compensation can hold the map
         * still, because the thing being compensated for has already happened.
         */
        trackResize: false,
        /*
         * Credit stays on every rendered map (CLAUDE.md §12) — but compact, so it
         * is one small ⓘ rather than a bar of text glaring off a dark basemap.
         *
         * No `customAttribution`: the tile source's own TileJSON already credits
         * OpenFreeMap, OpenMapTiles and OpenStreetMap. Adding ours printed all
         * three a second time, which is where the doubled line came from.
         */
        attributionControl: { compact: true },
      });

      /*
       * Bottom-left, and it is the only control this map has.
       *
       * Left rather than right because the right-hand corner is already spoken
       * for twice over: MapLibre's own attribution is built by the constructor
       * and sits there, and the shape/route card docks above it
       * (components/map/shapes/shape-card/shape-card.tsx). Nothing of ours is in
       * the bottom-left, so the stack lands on empty ground and the two corners
       * cannot collide.
       *
       * Top-right, where this used to be, is where the floating toolbar wraps
       * to — which is why `map-toolbar.tsx` carried a `pr-12` for as long as the
       * zoom buttons lived there.
       */
      map.addControl(
        new NavigationControl({
          showCompass: initial.current.showCompass === true,
        }),
        "bottom-left",
      );

      const instance = map;

      /*
       * The size the opening frame above was computed against.
       *
       * The constructor measures the container, and the comment on the resize
       * below explains that it can be measuring a layout that has not settled.
       * When it was, the fit is right and nothing more happens; when it was not,
       * neither the fit *nor its tile request* meant anything, so re-fitting on
       * load is still the first real load rather than a second one.
       */
      const built = box.getBoundingClientRect();

      map.on("load", () => {
        setIsReady(true);
        collapseAttribution(element);

        /*
         * One resize, once the style is in. This is not belt-and-braces — without
         * it the map renders nothing at all.
         *
         * MapLibre decides which tiles it needs from the viewport it knows about,
         * and it only recomputes that when something tells it to. The container is
         * measured in the constructor, which runs a style fetch earlier than the
         * layout it is measuring: `loadMapStyle` is awaited first, so the map is
         * built against whatever size the frame happened to have at that moment.
         * Once the style finishes loading nothing asks again, so the map sits
         * there with a correct canvas, working controls, a loaded style — and an
         * empty screen, no tile request and not one line in the console.
         *
         * The ResizeObserver below cannot cover this. It fires when the frame
         * changes size, and on a page where the frame never changes size again it
         * fires exactly once, ~80ms in — before `load`, on a map with no style yet,
         * where a resize does nothing. Then it never fires again.
         *
         * This used to be covered by accident: the old observer watched the
         * container rather than the frame, and MapLibre mutating that container on
         * setup produced the post-load resize as a side effect. Moving the
         * observation to the frame removed it and took the basemap with it.
         */
        instance.resize();

        // Only when the constructor measured a box that has since changed —
        // see `built`. On a frame that was already laid out this is skipped, and
        // the map never moves after the view it was born with.
        if (opening) {
          const now = box.getBoundingClientRect();
          const moved =
            Math.round(now.width) !== Math.round(built.width) ||
            Math.round(now.height) !== Math.round(built.height);

          if (moved) {
            instance.fitBounds(
              [
                [opening.west, opening.south],
                [opening.east, opening.north],
              ],
              { padding: 48, maxZoom: maxFitZoom, duration: 0 },
            );
          }
        }
      });

      /*
       * Re-asserted on every style load, not just the first. Switching basemap or
       * theme calls `setStyle`, which makes MapLibre rebuild its attribution from
       * the new sources — and a rebuilt control comes back expanded.
       */
      map.on("styledata", () => collapseAttribution(element));

      // MapLibre reports tile, style and worker failures through this event and
      // nowhere else — without it, a broken basemap is silent.
      map.on("error", (event) => console.error("[maplibre]", event.error));

      mapRef.current = map;

      /*
       * MapLibre only re-reads its size when told to, and the frame changes size
       * for two reasons: the `lg` breakpoint swapping the editor between stacked
       * and side-by-side, and the nav sidebar animating its width for 220ms.
       *
       * `resize()` on its own is not enough, because it preserves the map's
       * *centre*. The frame grows and shrinks on its left edge only — the nav
       * sidebar is to the left of it and the locations panel to the right is a
       * fixed width — so a 184px collapse moves the frame's midpoint 92px left,
       * and a centre-preserving resize drags the whole world along with it. Every
       * pin, the place card and the basemap slide across the screen, twice per
       * toggle, for a change that was never about the map at all.
       *
       * So each resize is followed by a pan that puts the geography back where it
       * was. The anchor is whichever edge moved *less* on the page, which is what
       * makes one rule cover every case: collapsing the sidebar moves the left
       * edge, so the map holds against the right; dragging the window's right edge
       * moves the right, so it holds against the left; a breakpoint cross picks
       * the smaller of the two and is at worst half wrong instead of fully.
       *
       * Per event, not debounced, and the pair of calls at the end is why that is
       * safe now. `resize()` assigns `canvas.width`, which reallocates and clears
       * the WebGL drawing buffer, and MapLibre defers the repaint to the next
       * animation frame; ResizeObserver callbacks run after rAF and before paint,
       * so a bare resize per event wipes the canvas after each render and before
       * it is composited — which is the solid grey map an earlier version of this
       * produced, and the reason it was reverted to a debounce. `redraw()` repaints
       * synchronously inside the callback and closes that window. MapLibre's own
       * resize handler does exactly this pair for exactly this reason.
       *
       * Debouncing instead would only move the problem: the canvas is stretched to
       * the frame by CSS (`.maplibregl-canvas`, app/globals.css) while the resize
       * is deferred, so the basemap scales while the DOM markers over it do not.
       *
       * This handles *changes* only. The one resize every map needs regardless is
       * in the `load` handler above.
       */
      let previous = box.getBoundingClientRect();

      observer = new ResizeObserver(() => {
        const rect = box.getBoundingClientRect();

        /*
         * A frame with no size would size the canvas to zero, and MapLibre would
         * hold it there until something resized it again — a blank map with
         * nothing logged. Cheaper to skip the resize and keep the last good one.
         */
        if (rect.width === 0 || rect.height === 0) return;

        const before = previous;
        previous = rect;

        /*
         * Before the style is in there is no geography to hold anything against,
         * and nothing to repaint — `unproject` would be answering about a map that
         * is not showing yet. The `load` handler above does the authoritative
         * resize the moment there is, so this only has to keep the canvas the
         * right size until then.
         *
         * Also covers the observer's own first callback, which `observe()` fires
         * immediately with a size nothing has changed about.
         */
        if (!instance.isStyleLoaded()) {
          instance.resize();
          return;
        }

        // Nothing to hold the map against until there has been one good
        // measurement to compare with.
        if (before.width === 0 || before.height === 0) {
          instance.resize();
          instance.redraw();
          return;
        }

        const holdRight =
          Math.abs(rect.right - before.right) < Math.abs(rect.left - before.left);
        const holdBottom =
          Math.abs(rect.bottom - before.bottom) < Math.abs(rect.top - before.top);

        // Container coordinates of the anchor, and where that sits on the page.
        const anchorX = holdRight ? before.width : 0;
        const anchorY = holdBottom ? before.height : 0;
        const pageX = before.left + anchorX;
        const pageY = before.top + anchorY;

        // Read before the resize, while the transform still describes the canvas
        // this measurement came from.
        const anchor = instance.unproject([anchorX, anchorY]);

        instance.resize();

        /*
         * `duration: 0` so `move` fires synchronously: DOM markers reposition
         * inside this callback, in the same frame the frame's own edge moves. A
         * pan the markers learn about a frame late is a frame of them sliding.
         */
        const now = instance.project(anchor);
        instance.panBy([now.x - (pageX - rect.left), now.y - (pageY - rect.top)], {
          duration: 0,
        });

        instance.redraw();
      });

      observer.observe(box);
    })();

    return () => {
      cancelled = true;
      observer?.disconnect();
      map?.remove();
      mapRef.current = null;
      setIsReady(false);
    };
  }, [container, frame]);

  /**
   * Restyle in place when the basemap changes.
   *
   * The creation effect reads `initial` once, so without this the canvas keeps
   * whatever style it was born with. That went unnoticed because the picker is on
   * /settings and the canvas on /maps/[id], so navigating between them remounted
   * the map — but nothing guarantees that, and it broke the moment the two ever
   * shared a screen.
   *
   * The guard compares the URL *and* everything applied on top of it, which is
   * what makes Auto work in both directions: toggling the dashboard theme on an
   * Auto map re-inverts the same Liberty style, and toggling it on a map pinned
   * to a basemap or a theme correctly does nothing.
   *
   * Safe here specifically because editor pins are DOM `Marker` elements
   * (components/map/pin-marker.ts), which are not part of the style and survive
   * the swap. Do not copy this into the embed: that one draws places as a GeoJSON
   * source with cluster/point layers, and `setStyle` drops both.
   *
   * Shapes are the editor's one exception to that — they *are* style layers —
   * and `transformStyle` is what stops the swap dropping them. See
   * lib/map/carry-style.ts: it puts the runtime source and its layers on both
   * sides of MapLibre's diff, so the diff emits nothing for them and they are
   * never taken off the map in the first place. Without it every theme change
   * and every layer toggle deleted them and use-shape-layers.ts rebuilt them a
   * few frames later, which is what made them blink.
   */
  useEffect(() => {
    if (!isReady) return;
    if (applied.current === look) return;

    applied.current = look;

    let cancelled = false;

    void (async () => {
      let next: string | StyleSpecification;

      try {
        next = (await loadMapStyle(styleUrl, appearance)) as
          | string
          | StyleSpecification;
      } catch (error) {
        console.error("[maplibre]", error);
        return;
      }

      // The map can be torn down, or the style changed again, while the fetch is
      // in flight. Either way this result is stale.
      if (cancelled) return;

      mapRef.current?.setStyle(next, { transformStyle: carryRuntimeLayers });
    })();

    return () => {
      cancelled = true;
    };
  }, [isReady, styleUrl, appearance, look]);

  return { map: mapRef, isReady };
}

/** What the editor has always framed at, and so what everything else gets. */
const DEFAULT_MAX_FIT_ZOOM = 14;

/** One comparable string for "what the canvas is showing". */
function lookKey(styleUrl: string, appearance: MapAppearance | null): string {
  return `${styleUrl}\n${JSON.stringify(appearance)}`;
}
