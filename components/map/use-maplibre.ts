"use client";

// MapLibre v6 is ESM with named exports — there is no default export.
import {
  Map as MapLibreMap,
  NavigationControl,
  type StyleSpecification,
} from "maplibre-gl";
import { useEffect, useMemo, useRef, useState } from "react";

import { effectiveAppearance } from "@/lib/map/appearance";
import { resolveStyleUrl, type MapStyleKey } from "@/lib/map/style";
import { collapseAttribution } from "@/packages/shared/attribution";
import { loadMapStyle } from "@/packages/shared/load-style";
import type { MapAppearance } from "@/packages/shared/map-appearance";
import { usePrefersDark } from "@/lib/theme/use-prefers-dark";

type Options = {
  center: { lng: number; lat: number };
  zoom: number;
  style: MapStyleKey;
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

      map = new MapLibreMap({
        container: element,
        style,
        center: [initial.current.center.lng, initial.current.center.lat],
        zoom: initial.current.zoom,
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

      map.addControl(new NavigationControl(), "top-right");

      const instance = map;

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

      mapRef.current?.setStyle(next);
    })();

    return () => {
      cancelled = true;
    };
  }, [isReady, styleUrl, appearance, look]);

  return { map: mapRef, isReady };
}

/** One comparable string for "what the canvas is showing". */
function lookKey(styleUrl: string, appearance: MapAppearance | null): string {
  return `${styleUrl}\n${JSON.stringify(appearance)}`;
}
