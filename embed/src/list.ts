import type { MapSnapshot, SnapshotPlace } from "@/packages/shared/snapshot";
import { tagChipsOf } from "@/packages/shared/tags";

import { el, link } from "./dom";
import { distanceKm, formatDistance, type Located } from "./geo";
import { directionsUrl } from "@/packages/shared/directions";

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
): ListHandle {
  /*
   * Resolved once for the whole list rather than per row: `createList` redraws
   * on every keystroke of the search box, and a map §6 allows 3,000 locations in
   * would otherwise walk sixty tags per row per character.
   */
  const tagGroups = snapshot.tagGroups ?? [];

  const categories = new Map(
    // Legacy, read-only: a snapshot published before categories became tags.
    // Nothing writes this field any more (§7 keeps it readable forever).
    (snapshot.categories ?? []).map((category) => [category.id, category]),
  );

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
    // `nearest` so a row already in view doesn't move, and so a list scrolled
    // into the middle of a customer's page doesn't drag the page with it.
    row.scrollIntoView({ block: "nearest" });
  };

  function buildRow(place: SnapshotPlace, origin: Located | null): HTMLElement {
    const item = el("li", "lm-list__item");

    // The whole card is the button, so the tap target is the row rather than
    // the name. Links live outside it — an <a> inside a <button> is neither
    // valid nor operable by keyboard.
    const pick = el("button", "lm-list__row");
    pick.type = "button";

    const head = el("div", "lm-list__head");
    head.append(el("span", "lm-list__name", place.name));

    if (origin) {
      head.append(
        el(
          "span",
          "lm-list__distance",
          formatDistance(distanceKm(origin, place)),
        ),
      );
    }

    pick.append(head);

    /*
     * One chip, and it is the one the pin beside it is wearing.
     *
     * A row is for choosing between places, not for reading one — the popup is
     * where the rest of a location's tags live. So the chip worth the width is
     * the one that explains the pin, which is exactly what the category chip
     * that used to sit here was.
     *
     * **The colour is what picks it, not the position**, and that is the whole
     * of the §7 back-compatibility here. A snapshot published before categories
     * became tags carries *both* — colourless `tagGroups` and a `category` — so
     * taking `tags[0]` would put a grey "Bikes" where a live customer site has
     * always shown an orange "Shops". The same precedence `colorOf` uses in
     * map.ts, so the dot on the row and the pin on the map cannot disagree.
     */
    const chips = tagChipsOf(tagGroups, place.tags);
    const legacy = categories.get(place.category ?? "");
    const chip =
      chips.find((candidate) => candidate.color) ??
      (legacy ? { label: legacy.label, color: legacy.color } : chips[0]);

    if (chip) {
      const node = el("span", "lm-list__tag", chip.label);
      if (chip.color) node.style.setProperty("--lm-tag-color", chip.color);
      pick.append(node);
    }

    if (place.address) {
      pick.append(el("span", "lm-list__address", place.address));
    }

    pick.addEventListener("click", () => onPick(place));
    item.append(pick);

    const actions = el("div", "lm-list__actions");
    actions.append(link("lm-list__link", "Directions", directionsUrl(place)));

    // Tapping a number to call it is the second thing anyone does with a store
    // locator on a phone. Everything else a place carries stays in the popup —
    // a list row is for choosing between places, not for reading one.
    if (place.phone) {
      actions.append(link("lm-list__link", place.phone, `tel:${place.phone}`));
    }

    item.append(actions);

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
