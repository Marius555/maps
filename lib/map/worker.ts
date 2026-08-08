import { config } from "maplibre-gl";

/**
 * Tell MapLibre where its worker lives.
 *
 * MapLibre derives the worker URL from `import.meta.url` inside its own bundle
 * and gives up — returning an empty string — when that isn't an http(s) URL,
 * which is the case under Turbopack. It then constructs `new Worker("")`, which
 * loads the current HTML document as the worker script. The worker exists but
 * never responds, so no tile is ever fetched and every map renders as a blank
 * background. There is no error in the console; it just silently does nothing.
 *
 * The files are copied into /public by scripts/copy-maplibre-worker.mjs, which
 * runs from `predev` and `prebuild`. If a map ever renders blank again, check
 * that public/maplibre/ exists before looking anywhere else.
 *
 * Week 3 note: the embed bundle is built with Vite, which resolves worker URLs
 * properly, so it should not need this. Verify rather than assume.
 */

const WORKER_URL = "/maplibre/maplibre-gl-worker.mjs";

let configured = false;

export function configureMaplibreWorker(): void {
  if (configured) return;
  configured = true;

  // Read once, when the first map is constructed, so setting it later would be
  // too late — hence module scope at the canvas import, not a component effect.
  config.WORKER_URL = WORKER_URL;
}
