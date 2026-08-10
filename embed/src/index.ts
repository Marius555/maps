import type { StyleSpecification } from "maplibre-gl";
import maplibreCss from "maplibre-gl/dist/maplibre-gl.css?inline";

import { loadMapStyle } from "@/packages/shared/load-style";
import type { MapSnapshot, SnapshotPlace } from "@/packages/shared/snapshot";

import { isDomainAllowed } from "./allowlist";
import {
  readConfig,
  readFocusPlaceId,
  warn,
  whenVisible,
  type EmbedConfig,
} from "./config";
import { el } from "./dom";
import { createFilters, matchesCategories } from "./filters";
import { nearestPlace, formatDistance, distanceKm } from "./geo";
import { createMap, type MapHandle } from "./map";
import { fetchSnapshot } from "./snapshot";
import {
  createNearestButton,
  createSearchField,
  currentPosition,
  matchesQuery,
} from "./search";
import embedCss from "./styles.css?inline";
import "./worker";

/**
 * Entry point.
 *
 * Boots one map per `<script data-snapshot>` on the page. Script tags are found
 * by attribute rather than through `document.currentScript`, which is always
 * null in an ES module — and MapLibre v6 is ESM only, so a module is what this
 * has to be.
 *
 * Nothing here writes an error into the host page. A failure is a console
 * warning and an empty container: a stranger's site must never sprout our
 * diagnostics.
 */

let stylesInjected = false;

function injectStyles(): void {
  if (stylesInjected) return;
  stylesInjected = true;

  // Inlined into the bundle so the embed stays one request. A separate
  // stylesheet would need its own CORS-correct URL on every customer's page.
  const style = el("style");
  style.textContent = `${maplibreCss}\n${embedCss}`;
  document.head.append(style);
}

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

  // Before the fetch, not just before the render: a page with four maps below
  // the fold should make no requests at all until they are scrolled towards.
  // The container is already sized, so nothing shifts when the map arrives.
  await whenVisible(container, config.eager);

  let snapshot: MapSnapshot;

  try {
    snapshot = await fetchSnapshot(config.snapshotUrl);
  } catch (error) {
    warn(`couldn't load the map data. ${String(error)}`);
    return;
  }

  if (!isDomainAllowed(window.location.hostname, snapshot.allowedDomains)) {
    warn(
      `this map isn't allowed on ${window.location.hostname}. ` +
        "Add the domain in the map's Publish settings.",
    );
    return;
  }

  injectStyles();
  await render(container, snapshot);
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

  const container = el("div");
  container.style.height = `${config.height}px`;
  script.insertAdjacentElement("afterend", container);

  return container;
}

async function render(
  container: HTMLElement,
  snapshot: MapSnapshot,
): Promise<void> {
  const isDark = resolveTheme(snapshot);

  /*
   * Auto's dark basemap is its light one recoloured here in the browser, not a
   * second style on the server — see lib/map/darken-style.ts for why (the stock
   * dark style carries no POI layers at all and its labels sit under the AA
   * contrast floor).
   *
   * `snapshot.autoDark` is what gates it, not `isDark` alone: a map pinned to
   * `dark` or `fiord` is already dark and must not be inverted a second time.
   *
   * Still no metered call in the visitor's path (CLAUDE.md §2) — this is the
   * same static style file MapLibre would have fetched itself, read by us first.
   */
  let style: string | StyleSpecification;

  try {
    style = (await loadMapStyle(
      snapshot.styleUrl,
      isDark && snapshot.autoDark === true,
    )) as string | StyleSpecification;
  } catch {
    // A working light map beats no map, and a stranger's site must never sprout
    // our diagnostics.
    style = snapshot.styleUrl;
  }

  const root = el("div", isDark ? "lm-root lm-root--dark" : "lm-root");
  root.style.height = "100%";

  const canvas = el("div", "lm-canvas");
  const toolbar = el("div", "lm-toolbar");
  const status = el("div", "lm-status");
  // Announced without stealing focus, so a filter result reaches a screen
  // reader the same moment it reaches the map.
  status.setAttribute("role", "status");
  status.setAttribute("aria-live", "polite");

  root.append(canvas, toolbar, status);
  container.replaceChildren(root);

  const map = createMap(canvas, snapshot, {
    style,
    focusPlaceId: readFocusPlaceId(),
  });
  wireControls({ map, snapshot, toolbar, status });
}

/**
 * Light or dark, for both the basemap and the panels.
 *
 * `autoDark` means the owner chose Auto, and Auto means *the person looking* — so
 * the visitor's own colour scheme decides. Otherwise the owner pinned a basemap
 * and `theme` carries the answer they published. Absent means light, which is
 * what snapshots written before either field existed get: they are immutable and
 * still being served to live sites.
 *
 * Resolved once, at boot, and never revisited. Following a mid-visit OS theme
 * change would mean `setStyle`, and this map draws its places as a GeoJSON
 * source with cluster and point layers that `setStyle` drops — re-adding them on
 * `styledata` is real complexity for a rare event a reload already fixes. The
 * editor makes the opposite call for the opposite reason: there, pins are DOM
 * markers that survive a restyle, and the owner toggles the theme constantly.
 */
function resolveTheme(snapshot: MapSnapshot): boolean {
  if (!snapshot.autoDark) return snapshot.theme === "dark";

  return (
    typeof window.matchMedia === "function" &&
    window.matchMedia("(prefers-color-scheme: dark)").matches
  );
}

function wireControls({
  map,
  snapshot,
  toolbar,
  status,
}: {
  map: MapHandle;
  snapshot: MapSnapshot;
  toolbar: HTMLElement;
  status: HTMLElement;
}): void {
  let query = "";
  let selected = new Set<string>();

  const visible = (): SnapshotPlace[] =>
    snapshot.places.filter(
      (place) =>
        matchesQuery(place, query) && matchesCategories(place.category, selected),
    );

  const apply = () => {
    const places = visible();
    map.setPlaces(places);

    if (places.length === 0) {
      status.textContent = "No locations match.";
      return;
    }

    status.textContent = "";
    // Only re-frame when something is actually narrowing the set; refitting on
    // an empty filter would yank the map back every time a search box clears.
    if (query || selected.size > 0) map.fitTo(places);
  };

  if (snapshot.settings.search) {
    toolbar.append(
      createSearchField((value) => {
        query = value;
        apply();
      }),
    );
  }

  if (snapshot.settings.nearest) {
    toolbar.append(createNearestButton(() => void goToNearest()));
  }

  if (snapshot.settings.filters) {
    const filters = createFilters(snapshot.categories, (next) => {
      selected = next;
      apply();
    });

    if (filters) toolbar.append(filters);
  }

  async function goToNearest(): Promise<void> {
    status.textContent = "Finding your location…";

    try {
      const position = await currentPosition();
      const candidates = visible();
      const nearest = nearestPlace(position, candidates);

      if (!nearest) {
        status.textContent = "No locations match.";
        return;
      }

      map.focusPlace(nearest);
      status.textContent = `${nearest.name} — ${formatDistance(
        distanceKm(position, nearest),
      )} away`;
    } catch {
      // The browser's own permission prompt already explained itself; this just
      // says the action didn't complete.
      status.textContent = "Couldn't get your location.";
    }
  }
}

// Module scripts are deferred, so the DOM is normally parsed by now. The guard
// covers a host page that injects the script some other way.
if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", boot, { once: true });
} else {
  boot();
}
