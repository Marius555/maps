import type { StyleSpecification } from "maplibre-gl";
import maplibreCss from "maplibre-gl/dist/maplibre-gl.css?inline";

import { MIDNIGHT_TINT } from "@/packages/shared/darken-style";
import { loadMapStyle } from "@/packages/shared/load-style";
import type { MapAppearance } from "@/packages/shared/map-appearance";
import type { MapSnapshot, SnapshotPlace } from "@/packages/shared/snapshot";

import { isDomainAllowed } from "./allowlist";
import {
  readConfig,
  readFocusPlaceId,
  warn,
  whenVisible,
  type EmbedConfig,
} from "./config";
import { button, el } from "./dom";
import {
  createFilters,
  createTagFilters,
  matchesCategories,
  matchesTags,
  tagGroupIndex,
} from "./filters";
import { createGazetteer } from "./gazetteer";
import { nearestPlace, formatDistance, distanceKm, type Located } from "./geo";
import { createList, type ListHandle } from "./list";
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
   * Everything the owner did to the basemap is applied here, in the browser, to
   * the style document MapLibre would have fetched anyway — a recolour, a label
   * level, a set of layer toggles (packages/shared/map-appearance.ts). Before
   * `createMap`, and only ever before it: this map draws its places as a GeoJSON
   * source with cluster layers, and `setStyle` drops them.
   *
   * Auto is the one case the snapshot cannot answer on its own. It publishes no
   * tint, because whether to darken depends on who is looking; `autoDark` gates
   * that, not `isDark` alone, since a map pinned to `dark`, `fiord` or a dark
   * theme is already dark and must not be inverted a second time.
   *
   * Still no metered call in the visitor's path (CLAUDE.md §2) — this is the
   * same static style file MapLibre would have fetched itself, read by us first.
   */
  const appearance: MapAppearance | null =
    isDark && snapshot.autoDark === true
      ? { ...snapshot.appearance, tint: MIDNIGHT_TINT }
      : (snapshot.appearance ?? null);

  let style: string | StyleSpecification;

  try {
    style = (await loadMapStyle(snapshot.styleUrl, appearance)) as
      | string
      | StyleSpecification;
  } catch {
    // A working plain map beats no map, and a stranger's site must never sprout
    // our diagnostics.
    style = snapshot.styleUrl;
  }

  const root = el("div", isDark ? "lm-root lm-root--dark" : "lm-root");
  root.style.height = "100%";

  const layout = el("div", "lm-layout");
  const canvas = el("div", "lm-canvas");
  const toolbar = el("div", "lm-toolbar");
  const status = el("div", "lm-status");
  // Announced without stealing focus, so a filter result reaches a screen
  // reader the same moment it reaches the map.
  status.setAttribute("role", "status");
  status.setAttribute("aria-live", "polite");

  /*
   * The two halves refer to each other, so one of them has to be built before
   * the other exists: the list opens a place on the map, and the map marks the
   * list's row when a pin is clicked. Declared here and assigned below, because
   * both references are read inside callbacks that cannot run until after
   * `createMap` has returned.
   *
   * Absent `list` means the owner switched the panel off — and it also means an
   * older snapshot, published before the setting existed, which must keep
   * rendering the bare map it has always rendered on their site.
   */
  let map: MapHandle | null = null;

  const list = snapshot.settings.list
    ? createList(snapshot, (place) => map?.focusPlace(place))
    : null;

  if (list) {
    // Search and filters belong to the results panel once there is one; over
    // the map they would cover the list rather than the thing they filter.
    toolbar.classList.add("lm-toolbar--docked");

    const panel = el("div", "lm-panel");
    panel.append(toolbar, list.element);
    layout.append(panel, canvas);
  } else {
    layout.append(canvas);
  }

  root.append(layout);
  // Floating controls hang off the root rather than the layout: they are
  // positioned against the whole box, and the layout is the flex row.
  if (!list) root.append(toolbar);
  root.append(status);

  container.replaceChildren(root);

  map = createMap(canvas, snapshot, {
    style,
    focusPlaceId: readFocusPlaceId(),
    onSelect: (placeId) => list?.select(placeId),
  });

  wireControls({ map, snapshot, toolbar, status, list });
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
  list,
}: {
  map: MapHandle;
  snapshot: MapSnapshot;
  toolbar: HTMLElement;
  status: HTMLElement;
  list: ListHandle | null;
}): void {
  let query = "";
  let selected = new Set<string>();
  let tags = new Set<string>();
  /*
   * Which group each tag belongs to, built once. `matchesTags` needs it on every
   * place on every keystroke, and walking the group list each time would be
   * three thousand places times sixty tags of work per character typed.
   */
  const groupOf = tagGroupIndex(snapshot.tagGroups ?? []);
  /**
   * Where the visitor is measuring from, once anything has said. Null until
   * then, and the list keeps the owner's own order while it is.
   *
   * Two things set it — "Nearest to me" and a place picked out of the search —
   * and both go through `setOrigin`, so the chip that says where the distances
   * are measured from can never disagree with the distances themselves.
   */
  let origin: Located | null = null;

  const nearby = el("div", "lm-origin");
  nearby.hidden = true;

  /**
   * Measure from here, and say so.
   *
   * The chip is not decoration. Without it the list is silently ordered by a
   * point the visitor can no longer see, and the only way back to the map's own
   * order is to reload the page — which reads as the widget having got stuck.
   */
  const setOrigin = (next: Located | null, label?: string) => {
    origin = next;

    if (!next) {
      nearby.hidden = true;
      nearby.replaceChildren();
      apply();
      return;
    }

    const clear = button("lm-origin__clear", "Clear");
    clear.setAttribute("aria-label", "Stop measuring from here");
    clear.addEventListener("click", () => setOrigin(null));

    nearby.replaceChildren(
      el("span", "lm-origin__label", `Near ${label ?? "you"}`),
      clear,
    );
    nearby.hidden = false;

    apply();
  };

  const visible = (): SnapshotPlace[] =>
    snapshot.places.filter(
      (place) =>
        matchesQuery(place, query) &&
        matchesCategories(place.category, selected) &&
        matchesTags(place.tags, tags, groupOf),
    );

  const apply = () => {
    const places = visible();
    map.setPlaces(places);
    // Before the empty check, not after: an empty result is exactly when the
    // list has something to say, and returning early would leave the last set
    // of rows sitting under a search that matches none of them.
    list?.setPlaces(places, origin);

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
      createSearchField({
        onQuery: (value) => {
          query = value;
          apply();
        },
        onPlace: (place) => setOrigin({ lat: place.lat, lng: place.lng }, place.label),
        gazetteer: createGazetteer(snapshot.gazetteer),
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

    // The same switch governs both: they are one control to a visitor, and a map
    // whose owner turned filtering off should not sprout half of it back.
    const tagFilters = createTagFilters(snapshot.tagGroups ?? [], (next) => {
      tags = next;
      apply();
    });

    if (tagFilters) toolbar.append(tagFilters);
  }

  async function goToNearest(): Promise<void> {
    status.textContent = "Finding your location…";

    try {
      const position = await currentPosition();

      /*
       * The answer is the whole list re-ordered, not one pin.
       *
       * Flying to the single nearest place was all a map could say. With a list
       * beside it, "nearest to me" means the visitor now has somewhere to
       * measure from — so every row shows its distance and the order becomes the
       * order they care about. The closest one is still opened, because that is
       * the question they asked.
       */
      setOrigin(position, "you");

      const nearest = nearestPlace(position, visible());

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

  // Under the controls rather than beside them: it is the *result* of using one,
  // and it appears and disappears, which inside a wrapping flex row would shuffle
  // the chips every time the visitor pressed it.
  toolbar.append(nearby);

  // The map builds itself from the snapshot; the list has to be told once.
  list?.setPlaces(snapshot.places, origin);
}

// Module scripts are deferred, so the DOM is normally parsed by now. The guard
// covers a host page that injects the script some other way.
if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", boot, { once: true });
} else {
  boot();
}
