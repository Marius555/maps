import { readConfig, warn, whenVisible, type EmbedConfig } from "./config";
import { fetchSnapshot } from "./snapshot";

/**
 * Entry point, shipped as `map.js` — the one URL pasted into customers' pages.
 *
 * Boots one map per `<script data-snapshot>` on the page. Script tags are found
 * by attribute rather than through `document.currentScript`, which is always
 * null in an ES module — and MapLibre v6 is ESM only, so a module is what this
 * has to be.
 *
 * **Why the map is a second file.** A module runs no code until every module it
 * imports statically has downloaded, and the map imports MapLibre, which imports
 * its shared chunk: three files in series, ~300KB, before the snapshot could
 * even be asked for — and a map three screens down the page paid all of it on
 * load. This file imports nothing heavy, so it runs at once; when a map's box
 * nears the viewport it asks for the snapshot, the map and both MapLibre files
 * **together**, and the slowest of them is the whole wait.
 *
 * It must import nothing the app chunk imports — see `page.ts`.
 *
 * Nothing here writes an error into the host page. A failure is a console
 * warning and an empty container: a stranger's site must never sprout our
 * diagnostics.
 */

/*
 * MapLibre's shared chunk, which `maplibre-gl.mjs` imports itself — but only
 * once it has arrived and been parsed. Asking for it here lets it travel beside
 * the main file. A runtime URL in a variable, like `WORKER_FILE` in worker.ts,
 * so the bundler leaves it alone; resolved against this module, so it is the
 * same URL the main file resolves and the browser fetches and runs it once.
 */
const SHARED_FILE = `./${__MAPLIBRE_DIR__}/maplibre-gl-shared.mjs`;

function boot(): void {
  const scripts = document.querySelectorAll<HTMLScriptElement>(
    "script[data-snapshot]",
  );

  for (const script of scripts) void mount(script);
}

async function mount(script: HTMLScriptElement): Promise<void> {
  // A module is evaluated once per URL however many times it is included, but
  // the guard also covers a host page that re-runs boot itself.
  if (script.dataset.lmMounted) return;
  script.dataset.lmMounted = "1";

  const config = readConfig(script);
  if (!config) return;

  const container = resolveContainer(script, config);
  if (!container) return;

  // Before any request, not just before the render: a page with four maps below
  // the fold should make no requests at all until they are scrolled towards.
  // The container is already sized, so nothing shifts when the map arrives.
  await whenVisible(container, config.eager);

  const snapshot = fetchSnapshot(config.snapshotUrl);
  // Reported by the app once it awaits it; this only keeps a failure that lands
  // before the app has arrived from also surfacing as an unhandled rejection.
  snapshot.catch(() => {});

  // Warm-ups only: the app's own imports are what count, and report.
  import("maplibre-gl").catch(() => {});
  import(/* @vite-ignore */ new URL(SHARED_FILE, import.meta.url).href).catch(() => {});

  let app: typeof import("./index");

  try {
    app = await import("./index");
  } catch (error) {
    warn(`couldn't load the map. ${String(error)}`);
    return;
  }

  await app.mount(container, config, snapshot);
}

/**
 * Where the map goes: an element the customer named, or one inserted right where
 * they pasted the script. The second case is what makes the snippet a single
 * line — no "and add a div with this id" step.
 */
function resolveContainer(
  script: HTMLScriptElement,
  config: EmbedConfig,
): HTMLElement | null {
  if (config.target) {
    const target = document.querySelector<HTMLElement>(config.target);
    if (!target) {
      warn(`couldn't find the element "${config.target}" to render into.`);
      return null;
    }

    target.style.height = `${config.height}px`;
    return target;
  }

  const container = document.createElement("div");
  container.style.height = `${config.height}px`;
  script.insertAdjacentElement("afterend", container);

  return container;
}

// Module scripts are deferred, so the DOM is normally parsed by now. The guard
// covers a host page that injects the script some other way.
if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", boot, { once: true });
} else {
  boot();
}
