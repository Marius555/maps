import type { StyleSpecification } from "maplibre-gl";
import maplibreCss from "maplibre-gl/dist/maplibre-gl.css?inline";

import { MIDNIGHT_TINT } from "@/packages/shared/darken-style";
import { chromeAttrs, chromeVars } from "@/packages/shared/embed-chrome";
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
import { createGazetteer } from "./gazetteer";
import { nearestPlace, formatDistance, distanceKm, type Located } from "./geo";
import { createList, type ListHandle } from "./list";
import { createMap, type MapHandle } from "./map";
import { fetchSnapshot } from "./snapshot";
import {
  buildSearchIndex,
  createNearestButton,
  createSearchField,
  currentPosition,
  locationFailure,
  matchesSearch,
  searchNeedle,
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
  applyChrome(root, snapshot);

  const layout = el("div", "lm-layout");
  const canvas = el("div", "lm-canvas");
  const toolbar = el("div", "lm-toolbar");
  const status = createStatus();

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
    // The search belongs to the results panel once there is one; over the map it
    // would cover the list rather than the thing it searches.
    toolbar.classList.add("lm-toolbar--docked");

    const panel = el("div", "lm-panel");
    panel.append(toolbar, list.element);

    /*
     * One source order, whichever edge the panel ends up on.
     *
     * Which side it sits on and whether it floats are `data-lm-side` and
     * `data-lm-float` on the root (`chromeAttrs`), and the stylesheet does the
     * rest — `order` for the docked case, a `translateX` for the floating one.
     * It used to be a real DOM swap here, which is what made a side flip cost
     * the publish preview an entire new document; source order cannot be
     * animated or rewritten on a running map, and an attribute can be both.
     *
     * Panel first is also the reading order the layout wants — search, then
     * results, then the map they are plotted on — and it is what a screen reader
     * gets on either side now rather than only on the left.
     */
    layout.append(panel, canvas);
  } else {
    layout.append(canvas);
  }

  root.append(layout);
  // Floating controls hang off the root rather than the layout: they are
  // positioned against the whole box, and the layout is the flex row.
  if (!list) root.append(toolbar);
  root.append(status.element);

  container.replaceChildren(root);

  map = createMap(canvas, snapshot, {
    style,
    focusPlaceId: readFocusPlaceId(),
    onSelect: (placeId) => list?.select(placeId),
  });

  /*
   * The running map, reachable from the element.
   *
   * The dashboard's publish preview renders this bundle in a same-origin
   * `srcdoc` frame and has to rebuild that document when a structural setting
   * changes. Without a way to ask where the map is looking first, every one of
   * those rebuilds threw the owner back to the saved default view — which is
   * what "the map keeps moving" meant. Nothing on a customer's site reads this;
   * it is a handful of bytes and the only seam a parent document has.
   */
  (root as HTMLElement & { lmMap?: MapHandle }).lmMap = map;

  wireControls({ map, snapshot, toolbar, status, list });
}

/**
 * Everything the owner designed about the chrome, onto the root.
 *
 * The table itself is `chromeVars` in /packages/shared, because the publish
 * preview writes the same properties into a running frame without rebuilding it
 * — see that file for why one table rather than two.
 */
function applyChrome(root: HTMLElement, snapshot: MapSnapshot): void {
  for (const [name, value] of Object.entries(chromeVars(snapshot.settings))) {
    if (value) root.style.setProperty(name, value);
  }

  // The layout's own state — which edge, and over or beside. Same rule: absent
  // is never written, and absent is what an older snapshot already renders.
  for (const [name, value] of Object.entries(chromeAttrs(snapshot.settings))) {
    if (value) root.setAttribute(name, value);
  }
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

type StatusHandle = {
  element: HTMLElement;
  /**
   * The one way the pill is written to. Empty text hides it.
   *
   * `sticky` is for a message describing something still true, or still
   * happening — "no locations match" stands until the filter changes, and
   * "finding your location" is replaced by its own outcome. Everything else is
   * an outcome, and an outcome goes away.
   */
  show: (text: string, sticky?: boolean) => void;
};

/**
 * The floating pill over the bottom of the map.
 *
 * It is `:empty { display: none }` that hides this, so a message used to sit
 * there until something happened to write over it — and after a failed location
 * lookup nothing did. On a map published with neither search nor filters there
 * was no code path that could clear it at all, so "couldn't get your location"
 * was permanent for the life of the page.
 *
 * It is shaped like a toast, so it behaves like one: long enough to read a
 * sentence twice, and a click takes it away sooner. Built as a handle rather
 * than a bare element so the timer and the element cannot be written to
 * separately.
 */
function createStatus(): StatusHandle {
  const element = el("div", "lm-status");

  // Announced without stealing focus, so a filter result reaches a screen
  // reader the same moment it reaches the map.
  element.setAttribute("role", "status");
  element.setAttribute("aria-live", "polite");
  element.title = "Dismiss";

  const LINGER_MS = 6_000;
  let timer = 0;

  const show = (text: string, sticky = false) => {
    window.clearTimeout(timer);
    element.textContent = text;

    if (!text || sticky) return;

    timer = window.setTimeout(() => {
      element.textContent = "";
    }, LINGER_MS);
  };

  element.addEventListener("click", () => show(""));

  return { element, show };
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
  status: StatusHandle;
  list: ListHandle | null;
}): void {
  const showStatus = status.show;

  /** The typed text, already trimmed and lowercased — see ./search.ts. */
  let needle = "";
  /*
   * Everything about a place a visitor might type, composed once: a map §6
   * allows 3,000 locations in would otherwise be re-composed per character.
   * This is what makes "retail" find the retail locations now that there are no
   * chips at all — tag labels are in here, so the word a visitor reads off a
   * pin's own card is the word that filters the map.
   */
  const searchIndex = buildSearchIndex(snapshot);
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
    snapshot.places.filter((place) =>
      matchesSearch(searchIndex, place, needle),
    );

  const apply = () => {
    const places = visible();
    map.setPlaces(places);
    // Before the empty check, not after: an empty result is exactly when the
    // list has something to say, and returning early would leave the last set
    // of rows sitting under a search that matches none of them.
    list?.setPlaces(places, origin);

    if (places.length === 0) {
      // Sticky: this describes the map as it stands, not something that just
      // finished, so it stays until the filter that caused it changes.
      showStatus("No locations match.", true);
      return;
    }

    showStatus("");
    // Only re-frame when something is actually narrowing the set; refitting on
    // an empty filter would yank the map back every time a search box clears.
    if (needle) map.fitTo(places);
  };

  if (snapshot.settings.search) {
    toolbar.append(
      createSearchField({
        onQuery: (value) => {
          needle = searchNeedle(value);
          apply();
        },
        onPlace: (place) => setOrigin({ lat: place.lat, lng: place.lng }, place.label),
        gazetteer: createGazetteer(snapshot.gazetteer),
      }),
    );
  }

  if (snapshot.settings.nearest) {
    // The promise is handed back rather than voided, so the button can disable
    // itself for as long as the lookup actually takes.
    toolbar.append(createNearestButton(() => goToNearest()));
  }

  /*
   * There were tag chips here, and before them category chips, and both are
   * gone. A chip row is a second vocabulary competing with the search box for
   * the top of a panel that is a proportion of the embed rather than a fixed
   * 320px — and every label it could offer is already in the search index, so
   * the question it answered is answered by typing the word. `settings.filters`
   * is still in the contract because published snapshots carry it; nothing
   * reads it.
   */

  async function goToNearest(): Promise<void> {
    // Sticky: it is replaced by its own outcome, which may be ten seconds away.
    showStatus("Finding your location…", true);

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
        showStatus("No locations match.", true);
        return;
      }

      map.focusPlace(nearest);
      /*
       * Written after `setOrigin`, which runs `apply()` and blanks the pill —
       * and not sticky, because the answer is now on the map and in the list's
       * own order. Leaving it up meant a distance from a lookup several minutes
       * old sitting over someone's map until they searched for something.
       */
      showStatus(
        `${nearest.name} — ${formatDistance(distanceKm(position, nearest))} away`,
      );
    } catch (error) {
      /*
       * Which of the four it was. The browser's own prompt explains itself only
       * when there *was* a prompt — a permission already denied, an insecure
       * origin and a ten-second timeout all arrive with nothing shown, and one
       * sentence covering all of them tells the visitor nothing they can act on
       * (§8).
       */
      const reason = locationFailure(error);

      showStatus(
        reason === "denied"
          ? "Location is off for this site. Turn it on in your browser, then try again."
          : reason === "timeout"
            ? "Couldn't find you in time. Try again."
            : reason === "unsupported"
              ? "This browser can't share a location."
              : "Couldn't get your location.",
      );
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
