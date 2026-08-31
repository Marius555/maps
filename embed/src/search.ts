import {
  buildSearchIndex,
  matchesSearch,
  searchNeedle,
  type SearchIndex,
} from "@/packages/shared/search-text";

import { button, el, icon } from "./dom";
import type { Gazetteer, GazetteerHit } from "./gazetteer";

/**
 * What the text filter reads, and how the query is prepared.
 *
 * Re-exported rather than reimplemented, the way ./geo.ts re-exports the
 * distance maths and ./filters.ts re-exports the tag rule: the composing lives
 * in /packages/shared because that is the only side of the boundary vitest can
 * reach, and the rest of the embed still imports its searching from one place.
 */
export { buildSearchIndex, matchesSearch, searchNeedle };
export type { SearchIndex };

/** Ties the input to its listbox for assistive tech. One map, one id. */
const LIST_ID = "lm-search-list";
/** Long enough that typing a postcode is one lookup, short enough to feel live. */
const LOOKUP_DELAY_MS = 180;

/**
 * Search and find-nearest, both entirely client-side.
 *
 * Search matches the places already in the snapshot — name, address, category
 * label and tag labels, composed once into an index by
 * @/packages/shared/search-text.ts — and, when the map ships one, a static
 * gazetteer of place names and postcodes (./gazetteer.ts). The labels are in
 * there because the category chips are not: with the row of chips gone, typing
 * the word a visitor read off a pin's own card is how they narrow the map, and
 * the search is the only control left that can answer.
 *
 * Neither half geocodes what the visitor typed: that
 * would be a metered call in the visitor's path, which CLAUDE.md §2 rules out.
 * The geocoder runs once at import time and never again.
 *
 * Find-nearest uses the browser's own geolocation, which costs nothing and is
 * more accurate than resolving a typed address anyway.
 */

export type SearchFieldOptions = {
  /** Text filter over the snapshot's own locations. Runs per keystroke. */
  onQuery: (query: string) => void;
  /** A place the visitor picked out of the gazetteer, to measure from. */
  onPlace: (hit: GazetteerHit) => void;
  /** Looks names and postcodes up. Always resolves; never rejects. */
  gazetteer: Gazetteer;
};

/**
 * The search box, and — when the map ships a gazetteer — the list of places
 * under it.
 *
 * Two different searches share one input on purpose. Typing filters the map's
 * own locations immediately, exactly as it always did, and nothing about that
 * path can fail. In parallel and debounced, the same text is looked up in the
 * gazetteer; if it names somewhere real, that appears as a list to pick from.
 * A visitor typing "Manchester" gets shops matching the word *and* the option to
 * measure from the city, without having to know we distinguish the two.
 *
 * Hand-rolled as a combobox — role, `aria-expanded`, `aria-activedescendant`,
 * arrow keys, Enter, Escape — because the embed has no component library and is
 * never getting one (§4). A control that only works with a mouse fails §8's
 * quality floor.
 */
export function createSearchField({
  onQuery,
  onPlace,
  gazetteer,
}: SearchFieldOptions): HTMLElement {
  const wrapper = el("div", "lm-search");

  const label = el("label", "lm-visually-hidden", "Search locations");
  label.htmlFor = "lm-search-input";

  const input = el("input", "lm-search__input");
  input.id = "lm-search-input";
  input.type = "search";
  input.placeholder = "Search locations or a postcode";
  input.autocomplete = "off";
  input.setAttribute("role", "combobox");
  input.setAttribute("aria-expanded", "false");
  input.setAttribute("aria-controls", LIST_ID);
  input.setAttribute("aria-autocomplete", "list");

  const list = el("ul", "lm-search__list");
  list.id = LIST_ID;
  list.setAttribute("role", "listbox");
  list.hidden = true;

  wrapper.append(label, input, list);

  let hits: GazetteerHit[] = [];
  let active = -1;
  /** Rises on every keystroke, so a slow lookup cannot overwrite a newer one. */
  let token = 0;
  let timer: ReturnType<typeof setTimeout> | undefined;

  const close = () => {
    hits = [];
    active = -1;
    list.hidden = true;
    list.replaceChildren();
    input.setAttribute("aria-expanded", "false");
    input.removeAttribute("aria-activedescendant");
  };

  const highlight = (next: number) => {
    const options = [...list.children];
    if (options.length === 0) return;

    // Wraps, so ArrowUp from the top reaches the last row rather than dead-ending.
    active = (next + options.length) % options.length;

    options.forEach((option, index) => {
      const isOn = index === active;
      option.classList.toggle("lm-search__option--on", isOn);
      option.setAttribute("aria-selected", String(isOn));
    });

    input.setAttribute("aria-activedescendant", `${LIST_ID}-${active}`);
  };

  const choose = (index: number) => {
    const chosen = hits[index];
    if (!chosen) return;

    close();

    /*
     * The field shows where we are now measuring from — but it stops *filtering*
     * by that text, and the two halves of that are both deliberate.
     *
     * "Kaunas" as a picked place is a question about distance, not a request for
     * locations whose name contains "Kaunas". Leaving the text filter on would
     * empty the list at the exact moment the visitor told us where to measure
     * from, which is the one case this whole control exists for: searching a
     * town the customer has no branch in, and finding the nearest ones.
     */
    input.value = chosen.label;
    onQuery("");
    onPlace(chosen);
  };

  const show = (found: GazetteerHit[]) => {
    hits = found;
    active = -1;

    if (found.length === 0) {
      close();
      return;
    }

    list.replaceChildren(
      ...found.map((found_, index) => {
        const option = el("li", "lm-search__option", found_.label);
        option.id = `${LIST_ID}-${index}`;
        option.setAttribute("role", "option");
        option.setAttribute("aria-selected", "false");
        // `mousedown`, not `click`: the input's blur fires first and would close
        // the list out from under the pointer.
        option.addEventListener("mousedown", (event) => {
          event.preventDefault();
          choose(index);
        });

        return option;
      }),
    );

    list.hidden = false;
    input.setAttribute("aria-expanded", "true");
  };

  input.addEventListener("input", () => {
    // Filtering the snapshot is free and stays immediate; only the lookup waits.
    onQuery(input.value);

    const mine = (token += 1);
    clearTimeout(timer);

    timer = setTimeout(() => {
      void gazetteer(input.value).then((found) => {
        if (mine === token) show(found);
      });
    }, LOOKUP_DELAY_MS);
  });

  input.addEventListener("keydown", (event) => {
    if (event.key === "Escape") {
      close();
      return;
    }

    if (list.hidden) return;

    if (event.key === "ArrowDown") {
      event.preventDefault();
      highlight(active + 1);
    } else if (event.key === "ArrowUp") {
      event.preventDefault();
      highlight(active - 1);
    } else if (event.key === "Enter" && active >= 0) {
      // Only with a row highlighted: Enter on a bare query belongs to the host
      // page's form, if it has one, and stealing it would be rude.
      event.preventDefault();
      choose(active);
    }
  });

  // Leaving the field puts the list away. Deferred, because a pointer press on a
  // row blurs the input before the row's own handler runs.
  input.addEventListener("blur", () => setTimeout(close, 0));

  return wrapper;
}

/**
 * Find-nearest, as a glyph.
 *
 * "Nearest to me" spelled out is about 120px of a toolbar that also has to hold
 * a search box and a row of tag chips — and it sits in a panel that is now a
 * proportion of the embed rather than a fixed 320px, so on a small map it was
 * the control that pushed everything else onto a second line. The crosshair is
 * the same symbol the browser's own geolocation control uses, which is the one
 * next to it.
 *
 * The name is not lost, only unspelled: `aria-label` gives it to assistive tech
 * and `title` gives it to a pointer that hovers. An icon-only control without
 * both is a control nobody can identify (§8).
 */
export function createNearestButton(
  /**
   * Awaited, so the control can say it is working.
   *
   * Geolocation is allowed ten seconds before it gives up, and a control that
   * looks idle for ten seconds after a click reads as broken rather than busy —
   * which is most of what "it doesn't work" meant here. Disabling it for the
   * duration also stops a second click stacking a second request behind the
   * first.
   */
  onNearest: () => Promise<void> | void,
): HTMLButtonElement {
  const control = button("lm-button lm-button--icon", "");
  const label = "Nearest to me";

  control.setAttribute("aria-label", label);
  control.title = label;
  control.append(
    icon([
      "M2 12h3",
      "M19 12h3",
      "M12 2v3",
      "M12 19v3",
      "M19 12a7 7 0 1 1-14 0 7 7 0 0 1 14 0",
      "M15 12a3 3 0 1 1-6 0 3 3 0 0 1 6 0",
    ]),
  );

  control.addEventListener("click", () => {
    if (control.disabled) return;

    control.disabled = true;
    control.setAttribute("aria-busy", "true");

    void Promise.resolve(onNearest()).finally(() => {
      control.disabled = false;
      control.removeAttribute("aria-busy");
    });
  });

  return control;
}

/**
 * Why a location lookup didn't produce one.
 *
 * Kept as a reason rather than flattened into a message, because the three the
 * browser reports need different things from the visitor: a blocked permission
 * has to be turned back on, a timeout is worth another try, and an unavailable
 * fix is nobody's fault. Collapsing them into one sentence — which is what the
 * bare `catch` here used to do — is wrong two times out of three.
 */
export type LocationFailure =
  | "unsupported"
  | "denied"
  | "unavailable"
  | "timeout";

type LocationError = Error & { reason: LocationFailure };

function locationError(reason: LocationFailure, message: string): LocationError {
  return Object.assign(new Error(message), { reason });
}

/** The reason off a rejection, for anything that reaches the catch some other way. */
export function locationFailure(error: unknown): LocationFailure {
  return (error as Partial<LocationError> | null)?.reason ?? "unavailable";
}

/**
 * Geolocation, promisified.
 *
 * Rejects rather than falling back to an IP lookup: an IP-derived position can
 * be a hundred kilometres out, and silently showing the wrong "nearest store"
 * is worse than saying it didn't work.
 *
 * `navigator.geolocation` is defined even where it cannot work — an insecure
 * origin, or a frame that was not granted the permission — so the guard below
 * catches only a browser without the API at all, and everything else arrives as
 * a real error with a code.
 */
export function currentPosition(): Promise<{ lat: number; lng: number }> {
  return new Promise((resolve, reject) => {
    if (!navigator.geolocation) {
      reject(
        locationError("unsupported", "This browser can't share a location."),
      );
      return;
    }

    navigator.geolocation.getCurrentPosition(
      (position) =>
        resolve({
          lat: position.coords.latitude,
          lng: position.coords.longitude,
        }),
      (error) =>
        reject(
          locationError(
            error.code === error.PERMISSION_DENIED
              ? "denied"
              : error.code === error.TIMEOUT
                ? "timeout"
                : "unavailable",
            error.message,
          ),
        ),
      { enableHighAccuracy: false, timeout: 10_000, maximumAge: 300_000 },
    );
  });
}
