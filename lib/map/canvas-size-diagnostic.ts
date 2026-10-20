import type { Map as MapLibreMap } from "maplibre-gl";

/**
 * MapLibre's default `maxCanvasSize`, per side, in device pixels.
 *
 * Mirrored rather than read: MapLibre keeps it on a private field, and
 * `use-maplibre.ts` does not override it, so the default is what applies.
 */
export const MAPLIBRE_MAX_CANVAS = 4096;

/** How far up the tree the report walks before it stops. */
const ANCESTOR_LEVELS = 10;

let reported = false;

/**
 * Says *why* MapLibre is about to warn that the canvas is larger than
 * `maxCanvasSize` — which its own message does not.
 *
 * That warning arrives once per page load with no sizes in it (`warnOnce`
 * de-duplicates by message), and the one sighting so far came from the resize
 * that runs before the style has loaded, on a container that was the right size
 * a moment earlier and again a moment later. It could not be reproduced, so
 * this is here to catch the next one: the container's size, the pixel ratio,
 * the page, which resize saw it, and every ancestor's box, nearest first — the
 * one that blew up is the first big number in the chain.
 *
 * Development only. It only reads and logs, and production builds drop it.
 * Delete it once the cause is found and fixed.
 */
export function reportOversizedCanvas(
  map: MapLibreMap,
  element: HTMLElement,
  site: string,
): void {
  if (process.env.NODE_ENV === "production" || reported) return;

  // The same two numbers MapLibre sizes the canvas from (`_containerDimensions`).
  const width = element.clientWidth;
  const height = element.clientHeight;
  const ratio = map.getPixelRatio();

  if (
    width * ratio <= MAPLIBRE_MAX_CANVAS &&
    height * ratio <= MAPLIBRE_MAX_CANVAS
  ) {
    return;
  }

  reported = true;

  const chain: string[] = [];
  let node = element.parentElement;

  for (let level = 0; node && node !== document.body && level < ANCESTOR_LEVELS; level++) {
    const box = node.getBoundingClientRect();
    const classes = typeof node.className === "string" ? node.className.slice(0, 60) : "";

    chain.push(
      `  ${node.tagName.toLowerCase()}${classes ? ` .${classes}` : ""} ${Math.round(box.width)}×${Math.round(box.height)}`,
    );
    node = node.parentElement;
  }

  console.warn(
    `[map] canvas over MapLibre's ${String(MAPLIBRE_MAX_CANVAS)}px limit at ${site}: ` +
      `container ${String(width)}×${String(height)} CSS px × ratio ${String(ratio)} ` +
      `on ${window.location.pathname}\n${chain.join("\n")}`,
  );
}
