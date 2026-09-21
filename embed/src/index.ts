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
import { button, el, icon } from "./dom";
import { createGazetteer } from "./gazetteer";
import { nearestPlace, formatDistance, distanceKm, type Located } from "./geo";
import { installDirectionsAsk, refreshDirections } from "./directions";
import { createList, type ListHandle } from "./list";
import { createMap, type MapHandle } from "./map";
import { fetchSnapshot } from "./snapshot";
import {
  buildSearchIndex,
  createNearestButton,
  setNearestOn,
  createSearchField,
  bestPosition,
  betterFix,
  currentPosition,
  locationFailure,
  type Fix,
  matchesSearch,
  searchNeedle,
} from "./search";
import embedCss from "./styles.css?inline";
import { createTracker, trackLinks, type Track } from "./track";
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

  /*
   * Built before anything that could report, and a no-op unless the owner
   * switched measurement on and republished (./track.ts). Everything downstream
   * takes it unconditionally, which is why no call site has to ask whether this
   * map is measured.
   */
  const track = createTracker(snapshot);

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
  /**
   * The visitor's *own* position, which is not the same question as `origin`.
   *
   * `origin` is whatever the distances are measured from, and a place picked out
   * of the search box sets it — a town, a postcode, somewhere the visitor is
   * not. This is only ever written from `navigator.geolocation`, because it has
   * one job: it is the start point handed to `directionsUrl`, and routing
   * somebody from a town they searched for is the bug this exists to fix, not a
   * feature.
   *
   * Module-scope would be defensible — two maps on one page have one visitor
   * between them — but it is per mount for the reason everything else here is:
   * nothing in this file reaches across roots.
   */
  let me: Fix | null = null;

  /**
   * The one writer of `me`, and it keeps the **sharpest** reading of the
   * session rather than the latest.
   *
   * Four things learn a position, and they are not equally good: the warm-up
   * below and the map's geolocate control ask for a precise one, while the
   * crosshair deliberately takes a cheap cached fix because it only has to
   * sort a list by distance. Last-writer-wins therefore let the worst of them
   * overwrite the best purely by arriving later, and the visible symptom is a
   * route starting on the wrong street.
   *
   * The rule itself is `betterFix` in ./search.ts, which is where it can be
   * tested — it reads the reading's *age* as well as its radius, because the
   * crosshair's cached fix can be five minutes old and still claim the tightest
   * accuracy of the session.
   *
   * **And it re-points the links already on screen**, which is the half that was
   * missing for as long as this feature looked broken. Every renderer reads `me`
   * when it draws, and the results panel draws once, synchronously, below —
   * before any of the four writers can possibly have answered. So a visitor who
   * pressed the map's own locate control, saw an accuracy circle around their
   * street and then pressed Directions in the sidebar was still routed from
   * their ISP's address. See `refreshDirections` in ./directions.ts.
   */
  const remember = (at: Fix) => {
    const best = betterFix(me, at);

    /*
     * Identity, and it is the right test rather than a cheap one: `betterFix`
     * hands back one of the two objects it was given, so `best === me` means the
     * session's answer did not change and every link already carries it. A
     * reading that ties on accuracy returns the newcomer — a different object,
     * possibly different coordinates — so that one does refresh, and should.
     */
    if (best === me) return;

    me = best;

    /*
     * `bestPosition` reports each reading as it arrives rather than the best one
     * at the end, so this can run a handful of times across a settle window. It
     * is a `querySelectorAll` over at most a hundred anchors and a string build
     * each; the alternative is a link drawn before the answer that never learns
     * it.
     */
    refreshDirections(root, best);
  };

  let map: MapHandle | null = null;

  /**
   * Shuts the drawer, when there is one open. See `installDrawer`.
   *
   * Assigned below rather than passed in, because the list is built before the
   * drawer that holds it — picking a location is the third way out of it, after
   * the trigger and Escape, and the one that matters most: the whole reason to
   * press a row is to see its pin.
   */
  let closeDrawer: (() => void) | undefined;

  const list = snapshot.settings.list
    ? createList(
        snapshot,
        (place) => {
          track("row", { id: place.id });
          closeDrawer?.();
          // `=== false`, so a snapshot that predates `rowCard` still opens it.
          map?.focusPlace(place, snapshot.settings.rowCard === false);
        },
        () => me,
      )
    : null;

  if (list) {
    // The search belongs to the results panel once there is one; over the map it
    // would cover the list rather than the thing it searches.
    toolbar.classList.add("lm-toolbar--docked");

    const panel = el("div", "lm-panel");
    panel.append(toolbar, list.element);

    /*
     * Both answers install a drawer and only the axis differs; **the key being
     * absent is the third answer**, and it is the one that must not reach here.
     * Stacking is what every snapshot published before this setting existed
     * draws on sites we do not control (§7).
     */
    if (snapshot.settings.panelDrawer !== undefined) {
      closeDrawer = installDrawer(
        root,
        panel,
        list.element,
        toolbar,
        snapshot.settings.panelDrawer,
      );
    }

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
    isDark,
    focusPlaceId: readFocusPlaceId(),
    onSelect: (placeId) => list?.select(placeId),
    getMe: () => me,
    track,
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

  wireControls({
    map,
    snapshot,
    toolbar,
    status,
    list,
    onLocated: remember,
    track,
  });

  /*
   * A warm-up, not a gate: the press it listens for is never delayed by it.
   *
   * On the root rather than on each link — a card is rebuilt on every pin
   * click and the results list on every keystroke, so a handler per Directions
   * link is a subscription per row per redraw. See embed/src/directions.ts for
   * why the press asks at all and why it must not wait for the answer.
   *
   * It writes `me` and deliberately **not** the list's `origin`: the distances
   * in the panel are the visitor's own question, asked by pressing the
   * crosshair, and re-sorting the whole list because somebody wanted directions
   * to one shop is the map answering a question nobody asked. Every Directions
   * link drawn after this does pick the origin up, because they all read `me`.
   */
  installDirectionsAsk(root, () => me, remember, track);
  trackLinks(root, track);
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

  /*
   * The untagged pin's colour, for the one renderer that is CSS rather than
   * canvas.
   *
   * Written here and not in `chromeVars`, because that table is exactly
   * `CHROME_SETTING_KEYS` — the keys the publish preview repaints on a running
   * map without rebuilding it — and a pin colour cannot honestly join it: the
   * markers and the results rows are rasterised images cached per
   * `pinImageId(icon, color)`, so a custom property reaches the card's Logo
   * block and nothing else. `colorOf` is what answers for the other two, and a
   * change to this rebuilds the preview.
   *
   * Unwritten when the snapshot has no answer, which is what leaves the
   * stylesheet's own `#7a828f` in charge on every file published before the
   * field existed (§7).
   */
  if (snapshot.settings.pinColor) {
    root.style.setProperty("--lm-pin", snapshot.settings.pinColor);
  }
}

/**
 * The width, in CSS pixels of the embed's own box, below which the results panel
 * becomes a drawer.
 *
 * The same 768 the stylesheet's drawer container query uses, and it has to be:
 * this decides where the toolbar lives and the query decides where the panel is
 * drawn, so a disagreement is a search box docked into a panel that is off the
 * edge of the map.
 *
 * **Not the 640 the stacked layout uses, and the gap is deliberate.** Stacking
 * is what a snapshot with no `panelDrawer` field draws on live customer sites,
 * so its breakpoint cannot move (§7); a drawer is opt-in and new, and a portrait
 * tablet is a width where a results column beside the map leaves neither of them
 * room. The stylesheet says the same at its own two queries.
 */
const DRAWER_MAX_WIDTH = 768;

/** How far a pointer travels on the strip before a press becomes a drag. */
const SHEET_SLOP = 6;

/**
 * How far the sheet must travel before release snaps it to the other state.
 *
 * Distance, not velocity, and the same 48 the dashboard's sheet uses: a flick
 * has already passed 48px before the finger lifts, and a velocity test would
 * make a slow deliberate half-drag land back where it started — the one case
 * where a person is clearly saying what they want.
 */
const SHEET_SNAP = 48;

/**
 * The results panel as a drawer on a narrow map — parked at the bottom or off
 * the side, and the setting chooses which.
 *
 * Returns the function that shuts it, or `undefined` when the snapshot did not
 * ask for one. **`panelDrawer` absent is the third answer**: the stacked layout
 * every map published before the setting existed draws, and still has to (§7),
 * so nothing here runs for those files. `false` is not the same thing — it is an
 * owner who has seen the switch and turned it off, and what they get is the side
 * drawer this had before the sheet replaced it.
 *
 * **Two axes, one mechanism.** `data-lm-drawer` carries `"sheet"` or `"side"`,
 * and everything under it is shared: `data-lm-open`, `list.inert`, Escape, and
 * the toolbar move below. What differs is the trigger, and it differs only
 * because the two parks leave it nowhere else to be:
 *
 * - **Sheet** keeps 44px of the panel on screen, and that strip *is* the
 *   trigger. It says a list is there, it is a real `<button>` so a keyboard and
 *   a mouse both toggle it, and it is draggable so a thumb can throw it open —
 *   the same gesture `components/ui/bottom-sheet.tsx` runs on the dashboard,
 *   down to the 6px of slop and the 48px snap. An owner who has used the editor
 *   should not have to learn a second one on the map they published.
 * - **Side** parks the whole panel off the edge with nothing of it showing, so
 *   the trigger has to live somewhere else: a hamburger in the floating toolbar,
 *   which is where it was until the sheet arrived. Lines, because the thing it
 *   opens is a list, and drawn rather than written for the room — it shares a
 *   row with the search field at 390px.
 *
 * **Neither gets a veil and neither moves focus**, and that is the part of the
 * side drawer deliberately left behind. A scrim would end the map behind the
 * panel still working, which is why the editor's sheet has none either — the
 * side drawer shuts on a press outside it instead, which lets that press
 * through to the map (see below). And `panel.focus()` is the subject of the
 * warning in `setOpen`: both triggers are real buttons carrying
 * `aria-expanded`, so there is nowhere focus needs to be sent.
 *
 * **The toolbar moves, and it has to be JavaScript that moves it.** Parked
 * either way, most of the panel is off screen, and a search box inside the part
 * that is not showing is a search box a visitor cannot reach — so at narrow
 * widths the toolbar comes out of the panel and floats over the map, which is
 * the arrangement a list-less map already uses. No stylesheet can do that:
 * `.lm-panel` is the containing block for its own absolutely-positioned
 * children, so a toolbar inside it travels with the transform however it is
 * positioned. Hence the observer, which is also the only honest way to ask a
 * container query's question from script.
 *
 * A `ResizeObserver` on the root rather than a `matchMedia`, for the reason
 * written at the top of the stylesheet: this widget is a div on somebody else's
 * page, and a 360px map on a 1440px monitor is narrow.
 */
function installDrawer(
  root: HTMLElement,
  panel: HTMLElement,
  list: HTMLElement,
  toolbar: HTMLElement,
  /** The owner's answer: a bottom sheet, or the side drawer. */
  sheet: boolean,
): () => void {
  root.setAttribute("data-lm-drawer", sheet ? "sheet" : "side");

  /*
   * The one control, in whichever form this axis can show.
   *
   * The strip's text *is* its accessible name, so there is no `aria-label` to
   * keep in step with it; the hamburger has no text, so it carries one. The
   * pill above the strip's words is a `::before`.
   *
   * **`aria-expanded` and no `aria-controls`, deliberately.** For the sheet the
   * list is this button's own next sibling, which is the disclosure pattern ARIA
   * describes — and there `aria-controls` is optional, thinly supported by
   * screen readers, and would cost the list a literal `id` that a second map on
   * the page would collide with. The hamburger is not a sibling of the list, but
   * naming one there and not here is two answers to one question for a property
   * that buys nothing in either.
   *
   * **The strip says the word and no count, and that is a correctness call
   * before it is a byte one.** A total printed there is the snapshot's, and the
   * list under it is whatever the search box and find-nearest have left — so it
   * would read "Locations · 40" over three matching rows, which is worse than
   * saying nothing. A live count means a callback out of `setPlaces`, which
   * costs more than it is worth for a number a visitor did not ask for; the
   * editor's strip carries one because managing the list is the whole point of
   * that screen.
   */
  const trigger = button(
    sheet ? "lm-grip" : "lm-button lm-button--icon",
    // The strip says the word; the hamburger is a glyph and carries the same
    // word as its label below.
    sheet ? "Locations" : "",
  );

  if (!sheet) {
    // The same name the strip carries, which is one control named once rather
    // than two names for one job — and `aria-expanded` is what says which state
    // it is in, on either axis.
    trigger.ariaLabel = "Locations";
    trigger.append(icon(["M4 6h16", "M4 12h16", "M4 18h16"]));
  }

  // Reflected rather than `setAttribute`, here and in `setOpen`. Baseline 2023,
  // the same vintage as the `inert` and `:has()` this bundle already needs.
  trigger.ariaExpanded = "false";

  let open = false;

  const setOpen = (next: boolean) => {
    if (next === open) return;

    open = next;
    trigger.ariaExpanded = String(next);
    /*
     * What actually keeps the parked part of the panel out of reach, and **note
     * that it is the list rather than the panel**.
     *
     * The sheet's strip lives inside `.lm-panel`, so marking the panel inert
     * would take that axis's own trigger out of the tab order with it. The list
     * is the part that is off screen in both, and the dashboard's sheet puts
     * `inert` on its content wrapper for exactly this reason.
     *
     * Why it is needed at all: parked out of view the rows are still tabbable,
     * and `.lm-root`'s `overflow: hidden` is still scrollable programmatically —
     * so focusing a row scrolls the root and drags the map out from under the
     * panel. `inert` takes the whole subtree out of the tab order and the
     * accessibility tree, and flips synchronously.
     *
     * **The evidence is `root.scrollLeft` 0 → 284, measured on the side
     * drawer**; parked downwards it is `scrollTop` instead. One trap, two axes,
     * one answer — which is why this line is not inside a branch.
     */
    list.inert = !next;

    if (next) root.setAttribute("data-lm-open", "1");
    else root.removeAttribute("data-lm-open");
  };

  /*
   * The drag.
   *
   * Pointer events and three window listeners — the pattern every gesture in
   * this repo runs, because HTML5 drag does not fire on touch at all and this
   * one exists for phones first. The pan is refused declaratively by
   * `touch-action: none` on the strip; `preventDefault()` here would do nothing.
   */
  trigger.addEventListener("pointerdown", (down) => {
    // The sheet's alone. A side drawer has no strip to drag — its trigger is a
    // 36px button in a toolbar, where a drag is a mispress rather than a
    // gesture, and there is no travel to measure because none of the panel is
    // on screen to follow the finger.
    if (!sheet) return;

    /*
     * Asked of the DOM at press time rather than tracked, because it is the one
     * number that cannot be wrong that way: the sheet is a percentage of a box
     * whose height changes when a phone's browser chrome collapses, and a travel
     * measured once is a sheet that stops short of its own edge afterwards.
     */
    const travel = panel.offsetHeight - trigger.offsetHeight;
    if (travel <= 0) return;

    const { style } = panel;
    const startOffset = open ? travel : 0;
    let offset = startOffset;
    let moved = false;

    const onMove = (move: PointerEvent) => {
      const delta = down.clientY - move.clientY;
      if (!moved && Math.abs(delta) < SHEET_SLOP) return;

      moved = true;
      // The sheet has to be under the finger, not 180ms behind it.
      style.transition = "none";
      offset = Math.min(travel, Math.max(0, startOffset + delta));
      style.transform = `translateY(${String(travel - offset)}px)`;
    };

    const bind = (op: typeof addEventListener) => {
      op("pointermove", onMove);
      op("pointerup", onEnd);
      op("pointercancel", onEnd);
    };

    const onEnd = () => {
      bind(removeEventListener);

      /*
       * Both cleared *before* `setOpen`, in the same task, so the browser sees
       * one style change: it interpolates the stylesheet's resting transform
       * from wherever the finger left the sheet. Clearing them afterwards would
       * snap it back and then slide it.
       *
       * Short of the snap there is deliberately nothing else to do — handing the
       * transform back to CSS has already returned it to where it started.
       */
      style.transition = "";
      style.transform = "";

      /*
       * **A press that never became a drag is the toggle, and it is handled here
       * rather than in the click listener.** The alternative was a `swallowClick`
       * flag: the strip is a real button, so a pointer released after 200px of
       * dragging fires a click too, and that click would undo the drag that just
       * landed. Deciding it on the gesture's own terms needs no state to leave
       * armed against an unrelated click later.
       */
      if (!moved) {
        setOpen(!open);
        return;
      }

      const delta = offset - startOffset;
      if (delta > SHEET_SNAP) setOpen(true);
      else if (delta < -SHEET_SNAP) setOpen(false);
    };

    bind(addEventListener);
  });

  /*
   * The click, which is the side drawer's whole interface and the sheet's
   * keyboard half.
   *
   * `detail` is the click count, and it is **0 for a click a browser synthesises
   * from Enter or Space** — every pointer-driven click carries at least 1. The
   * sheet needs that test, because its own pointer gesture above has already
   * decided what a press meant and a second answer here would undo it. The
   * hamburger has no gesture to disagree with, so it takes every click.
   */
  trigger.addEventListener("click", (event) => {
    if (!sheet || !event.detail) setOpen(!open);
  });

  root.addEventListener("keydown", (event) => {
    if (event.key === "Escape") setOpen(false);
  });

  /*
   * **The side drawer shuts on a press anywhere outside it, because open it
   * covers its own trigger.** The hamburger sits at the end of the floating
   * toolbar, which is exactly the edge the panel slides in over — measured at
   * 390px: trigger at x=344, open panel from x=80 to 380 at the z-index above
   * it. On a phone there is no Escape key, so without this the only way out was
   * to pick a location. The sheet needs none of it: its strip is the top of the
   * panel and is still there to press.
   *
   * A listener rather than the `.lm-veil` this used to have, and the difference
   * is the one the sheet was built on: a scrim swallows the press, so the map
   * behind it stops working until the panel is dismissed. This lets the press
   * through — a tap on the map shuts the drawer *and* reaches the map, so a pin
   * pressed past the panel opens its card in one go. The toolbar is excluded so
   * that typing in the search field does not shut the list it is filtering.
   */
  if (!sheet) {
    root.addEventListener("pointerdown", ({ target }) => {
      if (!panel.contains(target as Node) && !toolbar.contains(target as Node)) {
        setOpen(false);
      }
    });
  }

  /*
   * `null` rather than `false`, so the first callback always lands: an observer
   * fires once on observe, and that first run is what builds the narrow layout
   * on a map that boots narrow.
   */
  let narrow: boolean | null = null;

  new ResizeObserver(() => {
    const next = root.clientWidth <= DRAWER_MAX_WIDTH;
    if (next === narrow) return;

    narrow = next;

    if (next) {
      toolbar.classList.remove("lm-toolbar--docked");
      // On the root, where the list-less map already puts it, and after the
      // layout so it paints over the map.
      root.append(toolbar);
      /*
       * The strip is the panel's first child, which is why this waits until the
       * toolbar has left it. The hamburger rides in that toolbar instead — the
       * toolbar floating over the map is the whole reason a side drawer can
       * have a trigger at all.
       */
      if (sheet) panel.prepend(trigger);
      else toolbar.append(trigger);
      // Set here as well as in `setOpen`, which returns early when the state
      // has not changed — arriving narrow, the drawer is already shut.
      list.inert = !open;
      return;
    }

    setOpen(false);
    trigger.remove();
    // Back in the flow and reachable again: `inert` belongs to the drawer, not
    // to the list.
    list.inert = false;
    toolbar.classList.add("lm-toolbar--docked");
    panel.prepend(toolbar);
  }).observe(root);

  return () => {
    setOpen(false);
  };
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

/**
 * How long the search box must settle before what was typed is reported.
 *
 * `onQuery` fires on every keystroke, because that is what filters the map. A
 * report per keystroke would file "k", "ka", "kau", "kaun", "kauna", "kaunas"
 * as six searches, five of which nobody performed — and the whole value of this
 * measurement is the customer reading the words their visitors actually looked
 * for. Long enough to outlast typing, short enough to survive someone reading
 * the result and closing the tab.
 */
const SEARCH_REPORT_MS = 600;

function wireControls({
  map,
  snapshot,
  toolbar,
  status,
  list,
  onLocated,
  track,
}: {
  map: MapHandle;
  snapshot: MapSnapshot;
  toolbar: HTMLElement;
  status: StatusHandle;
  list: ListHandle | null;
  track: Track;
  /**
   * Report the visitor's own position upward, once the browser gives one.
   *
   * It is `render`'s to hold rather than this function's, because the two things
   * that read it — the results list and the map's popups — are built there. See
   * `me` in `render`.
   */
  onLocated: (at: Fix) => void;
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
   * and both go through `setOrigin`, so the control that says the distances are
   * being measured from somewhere can never disagree with the distances
   * themselves.
   */
  let origin: Located | null = null;

  /**
   * The find-nearest control, once there is one — it is optional per map.
   *
   * Held rather than only appended, because it is now the only thing on screen
   * saying an origin is set, so `setOrigin` has to be able to reach it.
   */
  let nearest: HTMLButtonElement | null = null;

  /**
   * Measure from here.
   *
   * There was a `Near you · Clear` chip under the toolbar, on the argument that
   * a list silently ordered by a point the visitor cannot see reads as stuck.
   * That argument is answered by the button that set it: `setNearestOn` lights
   * it, and pressing it while lit is what Clear was — one control, no row of
   * text explaining another control (§8).
   */
  const setOrigin = (next: Located | null) => {
    origin = next;
    if (nearest) setNearestOn(nearest, next !== null);
    apply();
  };

  const visible = (): SnapshotPlace[] =>
    snapshot.places.filter((place) =>
      matchesSearch(searchIndex, place, needle),
    );

  /**
   * The settled search, with how many locations it found.
   *
   * The count is the half that makes this worth collecting. "Sixty people
   * searched Kaunas" is a statistic; "sixty people searched Kaunas and found
   * nothing" is the customer's next shop.
   */
  let searchTimer = 0;

  const reportSearch = (query: string, matches: number) => {
    clearTimeout(searchTimer);
    if (!query) return;

    searchTimer = window.setTimeout(
      () => track("search", { q: query, n: matches }),
      SEARCH_REPORT_MS,
    );
  };

  const apply = () => {
    const places = visible();
    reportSearch(needle, places.length);
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

  if (snapshot.settings.nearest) {
    // The promise is handed back rather than voided, so the button can disable
    // itself for as long as the lookup actually takes.
    //
    // Lit, it is the Clear the chip under the toolbar used to be — so a press
    // asks which of the two states it is in rather than always locating.
    nearest = createNearestButton(
      () => {
        // Two different presses on one control, and a customer reading "nearest
        // pressed 40 times" should not be counting the 20 that cleared it.
        if (origin) {
          track("nearest_clear");
          return setOrigin(null);
        }

        track("nearest");
        return goToNearest();
      },
      // Inside the search field when there is one — see below. Left to its
      // default, it is the toolbar control it has always been.
      snapshot.settings.search ? "lm-search__action" : undefined,
    );
  }

  if (snapshot.settings.search) {
    toolbar.append(
      createSearchField({
        onQuery: (value) => {
          needle = searchNeedle(value);
          apply();
        },
        onPlace: (place) => {
          /*
           * The name, not just the press — and it is the most valuable six
           * bytes in this bundle.
           *
           * A visitor picks a town out of the gazetteer when the map had no
           * location to offer them for it. So this is somebody saying "I want a
           * shop in Kaunas", and a month of them is a ranked list of places
           * with demand and no presence. Recorded as a bare count it said
           * "picked a suggestion 37 times", which answers nothing.
           */
          track("pick", { q: place.label });
          setOrigin({ lat: place.lat, lng: place.lng });
        },
        gazetteer: createGazetteer(snapshot.gazetteer),
        /*
         * Find-nearest lives *in* the field, where a magnifier that did nothing
         * used to be.
         *
         * The glyph was a picture and the control beside it was the live thing,
         * which is the wrong way round in a row that runs out of width first on
         * exactly the maps the drawer exists for: at 390px the floating toolbar
         * is now the field and the drawer's own trigger, rather than three
         * controls fighting over 370px.
         */
        action: nearest ?? undefined,
      }),
    );
  } else if (nearest) {
    // No field to sit in, so it is a control on the toolbar as it always was.
    toolbar.append(nearest);
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
       * The one place the visitor's own position is learnt. Reported before
       * `setOrigin`, which re-renders the list — the rows' Directions links read
       * it on the way past.
       */
      onLocated(position);

      /*
       * The answer is the whole list re-ordered, not one pin.
       *
       * Flying to the single nearest place was all a map could say. With a list
       * beside it, "nearest to me" means the visitor now has somewhere to
       * measure from — so every row shows its distance and the order becomes the
       * order they care about. The closest one is still opened, because that is
       * the question they asked.
       */
      setOrigin(position);

      const closest = nearestPlace(position, visible());

      if (!closest) {
        showStatus("No locations match.", true);
        return;
      }

      /*
       * How far the nearest location actually was.
       *
       * Rounded to whole kilometres, and that rounding is the point rather than
       * tidiness: it is the one number here derived from the visitor's own
       * position, and a distance to a known shop is a position if it is precise
       * enough. Whole kilometres answer "are my visitors near my shops" without
       * answering "which street is this person on".
       */
      track("nearest_found", {
        km: Math.round(distanceKm(position, closest)),
      });

      map.focusPlace(closest);
      /*
       * Written after `setOrigin`, which runs `apply()` and blanks the status —
       * and not sticky, because the answer is now on the map and in the list's
       * own order. Leaving it up meant a distance from a lookup several minutes
       * old sitting over someone's map until they searched for something.
       */
      showStatus(
        `${closest.name} — ${formatDistance(distanceKm(position, closest))} away`,
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

      // Which of the four, because "nobody uses find-nearest" and "everybody
      // denies find-nearest" are different problems with different fixes.
      track("nearest_failed", { why: reason });

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

  /*
   * Where the visitor is, when the browser will say so without asking.
   *
   * Directions used to hand Google a destination and no start point, so Google
   * guessed one from the visitor's IP — which is how a route to a shop two
   * streets away starts in a forest forty kilometres out. The fix is to send the
   * real origin, and the only free source of one is the browser.
   *
   * **Nothing here may raise a prompt.** `permissions.query` answers `granted`
   * only when this origin has already been allowed — pressing "Nearest to me"
   * once, on a previous visit — so this is a read of a decision already taken,
   * never a new question asked of somebody who only opened a map. A browser
   * without the Permissions API (Safari) simply keeps today's behaviour, and so
   * does a visitor who has never granted it: `me` stays null and the link is
   * exactly the one that ships now.
   *
   * Fire and forget. A card opened before the answer lands keeps the link it was
   * built with; the next one gets the origin.
   */
  void navigator.permissions
    ?.query({ name: "geolocation" })
    .then((permission) => {
      const warm = () => {
        if (permission.state !== "granted") return;

        // Per reading, so the first Directions link drawn after this has an
        // origin rather than waiting out the whole window for a sharper one.
        void bestPosition(undefined, undefined, onLocated).catch(() => {
          // Nothing within the window, or the grant withdrawn between the read
          // and the lookup. No origin, and the link we always drew.
        });
      };

      /*
       * **A grant can arrive long after boot.** This read the state once and
       * stopped, so a visitor who allowed the prompt raised by their first
       * Directions press — the one gesture on this map that is about where they
       * are — was never asked for a position afterwards, and the press that
       * earned the permission was the only one that never benefited from it.
       * Whichever control raised it, this is where the answer is picked up.
       */
      permission.addEventListener("change", warm);
      warm();
    })
    .catch(() => {
      // Safari does not know the `geolocation` name and rejects outright. That
      // is today's behaviour: no origin, and the link we always drew.
    });

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
