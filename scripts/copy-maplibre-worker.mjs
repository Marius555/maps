/**
 * Copies MapLibre's worker bundle into /public so it has a real URL.
 *
 * Why this exists
 * ---------------
 * MapLibre v6 works out where to load its worker from by reading
 * `import.meta.url` inside its own bundle:
 *
 *     let url = import.meta.url;
 *     if (!/^https?:/.test(url)) return "";
 *
 * Under Turbopack that value isn't an http(s) URL, so the function returns an
 * empty string and MapLibre calls `new Worker("", { type: "module" })`. An empty
 * worker URL resolves against the *document*, so the worker tries to execute the
 * HTML page as a module script. The Worker object is created and never answers a
 * single message — which looks exactly like a blank basemap: the style, sprites
 * and TileJSON all load on the main thread, and not one tile is ever requested,
 * because vector tiles are fetched and parsed inside the worker.
 *
 * Setting `config.WORKER_URL` (see lib/map/worker.ts) fixes it, but only if the
 * file is actually served. Hence this copy.
 *
 * Both files are needed: maplibre-gl-worker.mjs imports ./maplibre-gl-shared.mjs
 * relatively, so they have to land in the same directory.
 *
 * Runs from `predev` and `prebuild`, so the copy can never drift from the
 * installed version. The output directory is gitignored — it's build output, not
 * a vendored dependency.
 */

import { copyFile, mkdir, readFile } from "node:fs/promises";
import { createRequire } from "node:module";
import { dirname, join } from "node:path";

/** What the dashboard needs: the worker and the chunk it imports. */
const WORKER_FILES = ["maplibre-gl-worker.mjs", "maplibre-gl-shared.mjs"];

/**
 * The embed additionally needs MapLibre's main entry, because its bundle keeps
 * `maplibre-gl` external and imports ./maplibre-gl.mjs as a sibling. That is
 * what lets the main thread and the worker share one copy of the 131KB shared
 * chunk instead of downloading it twice — see embed/vite.config.mts.
 */
const EMBED_FILES = [...WORKER_FILES, "maplibre-gl.mjs"];

/**
 * Two destinations, for two build targets:
 * - public/maplibre  — the dashboard, which points config.WORKER_URL at a fixed
 *   path (lib/map/worker.ts).
 * - public/embed     — the embed, which resolves the worker relative to its own
 *   bundle URL, so the files have to sit beside map.js. The embed runs on other
 *   people's domains; a shared path on ours is the only thing it can rely on.
 */
const TARGETS = [
  { dir: join(process.cwd(), "public", "maplibre"), files: WORKER_FILES },
  { dir: join(process.cwd(), "public", "embed"), files: EMBED_FILES },
];

const require = createRequire(import.meta.url);

async function main() {
  // Resolved through the package rather than a hardcoded node_modules path, so
  // this keeps working under pnpm/yarn layouts and in a monorepo.
  const distDir = dirname(require.resolve("maplibre-gl/dist/maplibre-gl.mjs"));

  for (const target of TARGETS) {
    await mkdir(target.dir, { recursive: true });

    for (const file of target.files) {
      await copyFile(join(distDir, file), join(target.dir, file));
    }
  }

  const { version } = JSON.parse(
    await readFile(require.resolve("maplibre-gl/package.json"), "utf8"),
  );

  console.log(
    `Copied MapLibre ${version} runtime files to public/maplibre/ ` +
      `(${WORKER_FILES.length}) and public/embed/ (${EMBED_FILES.length})`,
  );
}

main().catch((error) => {
  console.error("Failed to copy the MapLibre worker.");
  console.error(error);
  // Failing loudly matters: without these files every map renders blank.
  process.exit(1);
});
