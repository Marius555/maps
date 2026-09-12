import type { MapSnapshot, SnapshotPlace } from "@/packages/shared/snapshot";
import { pinCanvas } from "@/packages/shared/pin-raster";

import { el, link } from "./dom";
import { distanceKm, formatDistance, type Located } from "./geo";
import { colorOf, colorsOf, pinsOf } from "./map";
import { directionsLink } from "./directions";
import type { Fix } from "./search";

/**
 * The results panel beside the map.
 *
 * This is the control that makes the embed a store locator rather than a map
 * with pins on it: a visitor scanning for the nearest branch reads a list, and
 * only then looks at where it is. Every competitor in the category ships one.
 *
 * It renders the same set the map is showing — `visible()` in index.ts computes
 * it once and hands it to both — so a filter can never leave the two disagreeing
 * about what is on the map.
 *
 * What a row draws is the owner's to decide (`snapshot.settings`), and every one
 * of those fields is read the §7 way: absent means what this list drew before
 * the field existed, because a snapshot published a year ago is still live on
 * somebody's site and is read exactly as it was written.
 */

/**
 * How many rows are built at once.
 *
 * A Pro map holds 3,000 locations and this list is rebuilt on every keystroke.
 * Three thousand rows is roughly twenty thousand DOM nodes to create and throw
 * away per character typed, which on a mid-range phone is a visibly janky search
 * box on a customer's website — and nobody scrolls past the first screen anyway.
 * When an origin is set the cap is meaningful rather than arbitrary: these are
 * the hundred nearest, which is the whole question being asked.
 */
const MAX_ROWS = 100;

/** Drawn at twice the CSS size, so a row's pin is not soft on a retina screen. */
const PIN_PIXEL_RATIO = 2;

export type ListHandle = {
  element: HTMLElement;
  /**
   * Re-render against the currently visible places. `origin` sorts by distance
   * and prints one on each row; null keeps the owner's own order.
   */
  setPlaces: (places: SnapshotPlace[], origin: Located | null) => void;
  /** Mark a row as the open one, following the map. Null clears it. */
  select: (id: string | null) => void;
};

export function createList(
  snapshot: MapSnapshot,
  onPick: (place: SnapshotPlace) => void,
  /**
   * Where the visitor is, for the row's Directions link — read per row rather
   * than taken as a value, because the answer can arrive after the list is
   * drawn. Distinct from the `origin` `setPlaces` takes: that one may be a town
   * somebody searched for, and routing them from it is the bug this exists to
   * fix. See `me` in index.ts.
   */
  getMe: () => Fix | null = () => null,
): ListHandle {
  const settings = snapshot.settings;

  /*
   * Absent means what a row drew before the setting existed — see the header.
   * The three that were always drawn read as `!== false`; the pin, which is new,
   * has to be asked for.
   */
  const showPin = settings.rowPin === true;
  const showAddress = settings.rowAddress !== false;
  const showDistance = settings.rowDistance !== false;
  const showActions = settings.rowActions !== false;
  const pinSize = settings.rowPinSize ?? 28;

  /*
   * Resolved once for the whole list rather than per row: `setPlaces` redraws on
   * every keystroke of the search box, and a map §6 allows 3,000 locations in
   * would otherwise walk sixty tags per row per character.
   *
   * These are the map's own two, imported rather than reimplemented. A row's pin
   * and the pin it is a picture of must be the same colour, and the only way to
   * guarantee that is for one function to answer both — including the legacy
   * category fallback, which a second copy would be the first thing to drop.
   */
  const colors = colorsOf(snapshot);
  const pins = pinsOf(snapshot);

  const root = el("div", "lm-list");
  const items = el("ul", "lm-list__items");
  items.setAttribute("aria-label", "Locations");

  const footer = el("p", "lm-list__footer");

  root.append(items, footer);

  /** Rendered rows by place id, so `select` can find one without a DOM query. */
  let rows = new Map<string, HTMLElement>();
  let selectedId: string | null = null;

  const setPlaces = (places: SnapshotPlace[], origin: Located | null) => {
    const ordered = origin ? byDistance(places, origin) : places;
    const shown = ordered.slice(0, MAX_ROWS);

    rows = new Map();
    items.replaceChildren();

    if (shown.length === 0) {
      // The toolbar's status line says this too, but it can be scrolled well
      // out of view on a phone — and an empty box with no explanation reads as
      // the widget having broken rather than the filter having worked.
      items.append(el("li", "lm-list__empty", "No locations match."));
      footer.textContent = "";
      return;
    }

    for (const place of shown) {
      const row = buildRow(place, origin);
      rows.set(place.id, row);
      items.append(row);
    }

    footer.textContent =
      ordered.length > shown.length
        ? `Showing ${shown.length} of ${ordered.length}. Search to narrow it down.`
        : "";

    // The open popup survives a filter that still includes its place, so the
    // rebuilt row has to be marked again or the map and the list disagree.
    if (selectedId) select(selectedId);
  };

  const select = (id: string | null) => {
    const previous = selectedId ? rows.get(selectedId) : undefined;

    if (previous) {
      previous.classList.remove("lm-list__item--on");
      previous.removeAttribute("aria-current");
    }

    selectedId = id;
    if (!id) return;

    const row = rows.get(id);
    if (!row) return;

    row.classList.add("lm-list__item--on");
    row.setAttribute("aria-current", "true");
    reveal(row);
  };

  /**
   * Bring a row into view **by scrolling this list and nothing else**.
   *
   * `scrollIntoView({ block: "nearest" })` is what this was, and it is the bug
   * behind "pressing Nearest to me drags the sidebar out and I can't get rid of
   * it". On a narrow map the results panel is a drawer parked off the edge at
   * `translateX(100%)`, and `.lm-root` is `overflow: hidden` — which is still
   * scrollable programmatically. Asked to reveal a row inside that panel, the
   * browser does the only thing it can: it scrolls the nearest scrollable
   * ancestor, which is the root, and the basemap goes with it. The panel appears
   * to slide in, but nothing *opened* it — no veil, no `data-lm-drawer-open`, so
   * there is nothing to press to make it go away.
   *
   * Every route into a card lands here (`onSelect` → `select`), so the same
   * thing happened on a plain pin click. `inert` in `installDrawer` answers the
   * *focus* half of this trap and cannot answer this half: an explicit
   * `scrollIntoView` is not focus, and an inert subtree still scrolls.
   *
   * Two rect reads and one `scrollTop` write reproduce `block: "nearest"`
   * exactly — a row already in view does not move — with no way to reach an
   * ancestor. `root` is the scroller: `.lm-list` is the element carrying
   * `overflow-y: auto`.
   */
  function reveal(row: HTMLElement): void {
    const seen = root.getBoundingClientRect();
    const at = row.getBoundingClientRect();

    if (at.top < seen.top) root.scrollTop += at.top - seen.top;
    else if (at.bottom > seen.bottom) root.scrollTop += at.bottom - seen.bottom;
  }

  /**
   * This location's pin, as pixels.
   *
   * A canvas rather than an `<img>`: `packages/shared/pin-raster.ts` explains
   * why at length, and the short version is that a host page's CSP can refuse a
   * data URI without anybody finding out. The pixels themselves are cached and
   * shared by pin and colour, so a hundred rows of one brand copy one drawing.
   */
  function buildPin(place: SnapshotPlace): HTMLCanvasElement | null {
    const source = pinCanvas(
      place.icon ?? "",
      colorOf(place, colors, pins),
      pins,
    );

    if (!source) return null;

    const node = el("canvas", "lm-list__pin");
    const px = pinSize * PIN_PIXEL_RATIO;

    node.width = px;
    node.height = px;
    // The row's name is the accessible one; the pin repeats the colour of a
    // thing already on the map beside it.
    node.setAttribute("aria-hidden", "true");
    node.getContext("2d")?.drawImage(source, 0, 0, px, px);

    return node;
  }

  function buildRow(place: SnapshotPlace, origin: Located | null): HTMLElement {
    const item = el("li", "lm-list__item");
    // See the same line in ./popup.ts — one delegated listener counts link
    // presses on both surfaces and reads the location off the nearest ancestor.
    item.dataset.lmPlace = place.id;

    // The whole card is the button, so the tap target is the row rather than
    // the name. Links live outside it — an <a> inside a <button> is neither
    // valid nor operable by keyboard.
    const pick = el("button", "lm-list__row");
    pick.type = "button";

    if (showPin) {
      const pin = buildPin(place);
      if (pin) pick.append(pin);
    }

    /*
     * The text is its own column so the pin can sit beside all of it rather than
     * beside the first line. Without it a two-line row centres the pin against
     * the name and leaves the address hanging out to the left of nothing.
     */
    const text = el("span", "lm-list__text");

    const head = el("div", "lm-list__head");
    head.append(el("span", "lm-list__name", place.name));

    if (origin && showDistance) {
      head.append(
        el(
          "span",
          "lm-list__distance",
          formatDistance(distanceKm(origin, place)),
        ),
      );
    }

    text.append(head);

    if (showAddress && place.address) {
      text.append(el("span", "lm-list__address", place.address));
    }

    pick.append(text);
    pick.addEventListener("click", () => onPick(place));
    item.append(pick);

    /*
     * There was a tag chip here, and it is gone with the filter chips it was the
     * legend for. A row is for choosing between places, not for reading one, and
     * the colour it carried is now the pin at the head of the row — which is the
     * same answer to "which pin is this?" without a second coloured thing on the
     * line competing with it.
     */

    if (showActions) {
      const actions = el("div", "lm-list__actions");
      actions.append(
        directionsLink("lm-list__link", "Directions", place, getMe()),
      );

      // Tapping a number to call it is the second thing anyone does with a store
      // locator on a phone. Everything else a place carries stays in the popup —
      // a list row is for choosing between places, not for reading one.
      if (place.phone) {
        actions.append(link("lm-list__link", place.phone, `tel:${place.phone}`));
      }

      item.append(actions);
    } else {
      // Without the links the row's own bottom padding is the only thing left
      // between it and the next one's border.
      item.classList.add("lm-list__item--bare");
    }

    return item;
  }

  return { element: root, setPlaces, select };
}

/**
 * Nearest first.
 *
 * Copied before sorting: the array handed in belongs to the caller's `visible()`
 * and is filtered straight off `snapshot.places`, so sorting in place would
 * quietly reorder the snapshot itself and leave the map's own order dependent on
 * whether anyone had searched yet.
 */
function byDistance(places: SnapshotPlace[], origin: Located): SnapshotPlace[] {
  return [...places].sort(
    (a, b) => distanceKm(origin, a) - distanceKm(origin, b),
  );
}
