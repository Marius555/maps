import type {
  Map as MapLibreMap,
  MapOptions,
  StyleSpecification,
  ErrorEvent,
} from "maplibre-gl";

import { blankMissingIcons } from "@/packages/shared/missing-icons";
import type { ShapeBounds } from "@/packages/shared/shapes";

import type { Layout } from "./paper";
import { zoomFor } from "./paper";
import { visibleDeadline } from "./visible-deadline";

/**
 * The map, drawn again off screen at whatever size was asked for.
 *
 * Not a capture of the canvas on screen, and that is three decisions rather than
 * one:
 *
 * **`preserveDrawingBuffer` is a per-frame cost.** Setting it on the editor's map
 * would slow every frame of every session for a button most people press
 * occasionally. A throwaway map pays it for two seconds and then does not exist.
 *
 * **The screen is 1×.** An export is wanted for a slide, a report or a printer,
 * and upscaling a 1200px screenshot to A4 gives a blurry map with jagged labels.
 * MapLibre's `pixelRatio` option renders the *whole pipeline* at the ratio — the
 * labels, the icons, the line widths — so 300 DPI is genuinely 300 DPI rather
 * than a stretched 96.
 *
 * **The page is rarely the shape of the window.** A second map can be laid out at
 * the page's own aspect ratio; the one on screen cannot.
 *
 * The style comes from the live map's own `getStyle()`, already tinted and
 * already toggled, so a themed map exports as the theme with no second path
 * through `loadMapStyle` to keep in step.
 */

/** How long to wait for a style, and then for the tiles under it. */
const LOAD_TIMEOUT_MS = 30_000;
const IDLE_TIMEOUT_MS = 15_000;

export type ExportView = {
  style: StyleSpecification;
  center: { lng: number; lat: number };
  zoom: number;
  bearing: number;
  pitch: number;
  /** The live frame's size in CSS pixels — what the export's zoom is scaled from. */
  width: number;
  height: number;
};

export class ExportError extends Error {}

/**
 * Render, and hand back the canvas.
 *
 * `decorate` runs once the style is in and before anything is drawn, which is the
 * only window in which layers can be added — a source added before `load` is lost
 * and one added after `idle` is not in the frame that was captured.
 */
export async function renderMapCanvas(
  view: ExportView,
  layout: Layout,
  decorate: (map: MapLibreMap) => void | Promise<void>,
): Promise<HTMLCanvasElement> {
  return renderOffscreenMap(
    view.style,
    {
      center: view.center,
      zoom: zoomFor(view.zoom, { width: view.width, height: view.height }, layout),
      bearing: view.bearing,
      pitch: view.pitch,
    },
    layout,
    decorate,
  );
}

/** Where a throwaway map points: a camera, or a box to frame. */
export type OffscreenCamera =
  | {
      center: { lng: number; lat: number };
      zoom: number;
      bearing?: number;
      pitch?: number;
    }
  | {
      bounds: ShapeBounds;
      /** CSS pixels kept clear around the box. */
      padding: number;
      /** A single point is a zero-area box and would otherwise open at max zoom. */
      maxZoom: number;
    };

/** The hidden container's size in CSS pixels, and how much denser the canvas is. */
export type OffscreenSize = {
  cssWidth: number;
  cssHeight: number;
  pixelRatio: number;
};

/**
 * The lifecycle every throwaway map shares: build it off screen, wait for the
 * style, decorate, wait for the tiles, copy the pixels out, tear it down.
 *
 * The export is one caller; the maps list's previews (lib/map-preview) are the
 * other, and they frame a box of locations rather than copying a live camera —
 * which is the only reason the camera is a parameter rather than an `ExportView`.
 */
export async function renderOffscreenMap(
  style: string | StyleSpecification,
  camera: OffscreenCamera,
  size: OffscreenSize,
  decorate: (map: MapLibreMap) => void | Promise<void>,
): Promise<HTMLCanvasElement> {
  const container = document.createElement("div");

  /*
   * Off screen, not `display: none`.
   *
   * A hidden element has no layout, so `clientWidth` is zero and MapLibre sizes
   * its canvas to nothing. `visibility: hidden` has the same problem for a
   * different reason. Positioned far off the page it lays out normally, paints
   * normally, and is never seen. `pointer-events: none` because it is briefly a
   * real element over a real document.
   */
  container.style.cssText =
    `position: fixed; left: -20000px; top: 0; pointer-events: none; ` +
    `width: ${size.cssWidth}px; height: ${size.cssHeight}px;`;
  document.body.appendChild(container);

  /*
   * Imported here, not at the top of the file.
   *
   * MapLibre touches `window` while its module body runs (CLAUDE.md §7), so a
   * value import anywhere in the editor's static graph would evaluate it during
   * server rendering and crash the page — the canvas escapes that through its own
   * `ssr: false` dynamic boundary, and this hook has none. It also keeps 273KB of
   * map library out of the dashboard's initial bundle for everyone who never
   * presses Export.
   *
   * Same specifier, same module instance — so `config.WORKER_URL` is already in
   * place here when a caller has set it. The export's caller has: nothing can
   * reach it without a live map, and a live map means map-canvas-impl.tsx has
   * run. The maps list has no live map, so lib/map-preview/render-preview.ts sets
   * it itself. Without it every tile fetch silently does nothing and the image
   * comes back as an empty background (lib/map/worker.ts).
   */
  const { Map: MapLibreMapClass } = await import("maplibre-gl");

  const framing: Partial<MapOptions> =
    "bounds" in camera
      ? {
          bounds: [
            [camera.bounds.west, camera.bounds.south],
            [camera.bounds.east, camera.bounds.north],
          ],
          fitBoundsOptions: {
            padding: camera.padding,
            maxZoom: camera.maxZoom,
            duration: 0,
          },
        }
      : {
          center: [camera.center.lng, camera.center.lat],
          zoom: camera.zoom,
          bearing: camera.bearing ?? 0,
          pitch: camera.pitch ?? 0,
        };

  let map: MapLibreMap | null = null;

  try {
    map = new MapLibreMapClass({
      container,
      style,
      ...framing,
      // The whole reason this map exists at all: without it the canvas is cleared
      // the instant the frame is composited and `toBlob` returns transparency.
      canvasContextAttributes: { antialias: true, preserveDrawingBuffer: true },
      pixelRatio: size.pixelRatio,
      interactive: false,
      // Labels and icons cross-fade in over 300ms by default, so a capture taken
      // at the right moment can still catch them half-drawn.
      fadeDuration: 0,
      // Composited onto the bitmap afterwards instead — MapLibre's control is DOM
      // and would not be in the capture. See ./compose.ts.
      attributionControl: false,
      trackResize: false,
    });

    blankMissingIcons(map);

    const instance = map;
    await once(instance, "load", LOAD_TIMEOUT_MS, "The map didn't load in time.");
    await decorate(instance);
    await once(
      instance,
      "idle",
      IDLE_TIMEOUT_MS,
      "The map is still loading tiles. Try again in a moment.",
    );

    /*
     * Copied, not returned.
     *
     * The canvas belongs to the map and `map.remove()` frees its WebGL context —
     * after which reading it gives a blank image. So the pixels are taken across
     * to a 2D canvas here, while the context is still alive, and the map is torn
     * down immediately.
     */
    return copy(instance.getCanvas());
  } finally {
    map?.remove();
    container.remove();
  }
}

function copy(source: HTMLCanvasElement): HTMLCanvasElement {
  const canvas = document.createElement("canvas");
  canvas.width = source.width;
  canvas.height = source.height;

  const context = canvas.getContext("2d");
  if (!context) {
    throw new ExportError("Your browser wouldn't give us a canvas to draw on.");
  }

  context.drawImage(source, 0, 0);
  return canvas;
}

/**
 * One map event, as a promise, with a deadline.
 *
 * The deadline is the point. A tile server that never answers leaves `idle`
 * unfired forever, and without this the export button would spin until the tab
 * was closed with nothing to explain it.
 */
function once(
  map: MapLibreMap,
  event: "load" | "idle",
  timeoutMs: number,
  message: string,
): Promise<void> {
  return new Promise((resolve, reject) => {
    // Visible time only: a hidden tab draws no frames, so neither event can fire.
    const cancelDeadline = visibleDeadline(timeoutMs, () => {
      map.off(event, done);
      map.off("error", failed);
      reject(new ExportError(message));
    });

    function done() {
      cancelDeadline();
      map.off("error", failed);
      resolve();
    }

    /*
     * A style that will not parse is fatal; a tile that 404s is not.
     *
     * MapLibre reports both through `error`, so rejecting on any of them would
     * fail an otherwise perfect export because one tile at the edge of the frame
     * was missing. Only an error carrying no source is one the map itself could
     * not recover from.
     */
    function failed(event: ErrorEvent & { sourceId?: string }) {
      if (event.sourceId) return;

      cancelDeadline();
      map.off("idle", done);
      map.off("load", done);
      reject(new ExportError(event.error?.message ?? "The map failed to render."));
    }

    map.once(event, done);
    map.on("error", failed);
  });
}
