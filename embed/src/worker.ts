import { addProtocol, config } from "maplibre-gl";
import { Protocol } from "pmtiles";

/**
 * MapLibre setup that has to happen before the first Map is constructed.
 *
 * Worker URL
 * ----------
 * MapLibre works out where its worker lives from `import.meta.url` and gives up
 * — returning an empty string — when it can't. It then does `new Worker("")`,
 * which loads the host page's HTML as the worker script. The worker exists and
 * never answers, and because vector tiles are fetched inside it, the map renders
 * as an empty background with nothing in the console. The dashboard hits this
 * under Turbopack (see lib/map/worker.ts); the embed would hit it too.
 *
 * Here the fix is exact rather than a fixed path: this bundle is an ES module,
 * so `import.meta.url` is its own URL on our origin, and the worker sits next to
 * it. That matters because the embed runs on a customer's domain — a relative
 * path would look for the worker on *their* server.
 *
 * MapLibre loads a cross-origin worker through a blob that imports the absolute
 * URL, so the worker files must be served with CORS headers. next.config.ts sets
 * them for /embed and /maplibre.
 *
 * pmtiles
 * -------
 * Registered once, at init (CLAUDE.md §7). Snapshots currently point at
 * OpenFreeMap, which needs none of this; registering now means switching to our
 * own PMTiles extract on R2 is a URL change in the snapshot and nothing else —
 * no redeploy of an embed already pasted into customer sites.
 */

// Held in a variable so the bundler treats the URL as runtime-resolved rather
// than a build-time asset reference — the file is copied in after the build,
// and inlining it would defeat the point of sharing one copy with the worker.
const WORKER_FILE = "./maplibre-gl-worker.mjs";

config.WORKER_URL = new URL(WORKER_FILE, import.meta.url).href;

addProtocol("pmtiles", new Protocol().tile);
