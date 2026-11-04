import {
  buildSearchIndex,
  matchesSearch,
  searchNeedle,
  type SearchIndex,
} from "@/packages/shared/search-text";
import {
  bestPosition,
  betterFix,
  fromPositionError,
  locationError,
  locationFailure,
  toFix,
  type Fix,
  type LocationFailure,
} from "@/packages/shared/position";

import { button, el, icon } from "./dom";
import type { Gazetteer, GazetteerHit } from "./gazetteer";
import { t } from "./i18n";

/**
 * What the text filter reads, and how the query is prepared.
 *
 * Re-exported rather than reimplemented, the way ./geo.ts re-exports the
 * distance maths: the composing lives
 * in /packages/shared because that is the only side of the boundary vitest can
 * reach, and the rest of the embed still imports its searching from one place.
 */
export { buildSearchIndex, matchesSearch, searchNeedle };
export type { SearchIndex };

/**
 * Where the visitor is — re-exported for the same reason. It moved to
 * @/packages/shared/position.ts when the dashboard's own pin card started
 * sending a route's start too, so both sides run one `betterFix` and one
 * `bestPosition`; `currentPosition`, the cheap list-sorting read, is the
 * embed's alone and stays below.
 */
export { bestPosition, betterFix, locationFailure };
export type { Fix, LocationFailure };

/** Ties the input to its listbox for assistive tech. One map, one id. */
const LIST_ID = "lm-search-list";
/** Long enough that typing a postcode is one lookup, short enough to feel live. */
const LOOKUP_DELAY_MS = 180;

/**
 * Search and find-nearest, both entirely client-side.
 *
 * Search matches the places already in the snapshot — name, address and tag
 * labels, composed once into an index by @/packages/shared/search-text.ts — and,
 * when the map ships one, a static gazetteer of place names and postcodes
 * (./gazetteer.ts). The tag labels are in there because the chips alone cannot
 * carry them: a filter row long enough to scroll hides tags a visitor would have
 * found by typing, and typing the word they read off a pin's own card is the
 * one control that always answers.
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
  /**
   * A control to sit inside the field, at its trailing end — in practice
   * find-nearest, on a map with no results panel to hold it. Absent, the field
   * has nothing at its end: the magnifier that used to fill the slot was asked
   * to go.
   */
  action?: HTMLElement;
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
  action,
}: SearchFieldOptions): HTMLElement {
  const wrapper = el("div", "lm-search");

  const label = el("label", "lm-visually-hidden", t("searchLabel"));
  label.htmlFor = "lm-search-input";

  const input = el("input", "lm-search__input");
  input.id = "lm-search-input";
  input.type = "search";
  input.placeholder = t("searchPlaceholder");
  input.autocomplete = "off";
  input.setAttribute("role", "combobox");
  input.setAttribute("aria-expanded", "false");
  input.setAttribute("aria-controls", LIST_ID);
  input.setAttribute("aria-autocomplete", "list");

  const list = el("ul", "lm-search__list");
  list.id = LIST_ID;
  list.setAttribute("role", "listbox");
  list.hidden = true;

  /*
   * Inside the field, at the end of it, when the caller passed a control — at
   * the *end* rather than the start, because the placeholder is a sentence and
   * a leading glyph pushes it far enough right that a narrow panel truncates it.
   *
   * There is no magnifier any more, with or without one: it was asked to go,
   * and the placeholder already says what the field is for.
   */
  wrapper.append(label, input, list);
  if (action) input.after(action);

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
    } else if (event.key === "Enter") {
      // Only with the list open, and then the highlighted row or else the top
      // one: typing a postcode and pressing Enter is the natural gesture. With
      // no list, Enter belongs to the host page's form, if it has one.
      event.preventDefault();
      choose(Math.max(active, 0));
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
 *
 * **The control is also the indicator, and the way back.** There was a
 * `Near you · Clear` chip under the toolbar saying where the distances were
 * measured from; it was a line of text and a second control to explain one
 * button, in a panel that is a proportion of the embed. The button lights
 * instead (see `setNearestOn`), which is the one thing on screen that can say
 * "this is on" without spending a row — and pressing it while lit is what Clear
 * used to be, so nothing became unreachable.
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
   *
   * Called for both meanings — locate, and stop measuring — because which one a
   * press means is a question about the origin, which lives with the list that
   * reads it rather than here.
   */
  onNearest: () => Promise<void> | void,
  /**
   * The skin, for when this is drawn *inside* the search field rather than
   * beside it — see `createSearchField`'s `action`.
   *
   * It **replaces** the toolbar classes rather than joining them, which the
   * stylesheet explains at `.lm-search__action`: `.lm-toolbar--docked .lm-button`
   * is two classes and would otherwise paint a well inside the field, and a
   * one-class rule cannot out-weigh it. The state, the name and both meanings of
   * a press are identical either way, so it is a class rather than a second
   * constructor.
   */
  variant = "lm-button lm-button--icon",
): HTMLButtonElement {
  const control = button(variant, "");

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
  // At the foot of the results panel it is a full-width button, and a button
  // that wide says its name rather than leaving a glyph alone in a bar.
  if (variant === "lm-nearest") control.append(el("span"));
  setNearestOn(control, false);

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
 * Lit, or not — and what a press means in each state.
 *
 * `aria-pressed` rather than a class alone: a control that has two states has to
 * say so to something that cannot see the colour, and a toggle button is exactly
 * what this now is. The name changes with it, because "Nearest to me" on a
 * button that clears the origin is a control that lies about what it does.
 */
export function setNearestOn(control: HTMLButtonElement, on: boolean): void {
  const label = on ? t("nearestStop") : t("nearest");

  control.classList.toggle("lm-button--on", on);
  control.setAttribute("aria-pressed", String(on));
  // The footer's visible word, which has to change with the state for the same
  // reason the name does.
  const word = control.querySelector("span");
  if (word) word.textContent = label;
  control.setAttribute("aria-label", label);
  control.title = label;
}

/**
 * Geolocation, promisified — one reading, taken as it comes.
 *
 * Rejects rather than falling back to an IP lookup: an IP-derived position can
 * be a hundred kilometres out, and silently showing the wrong "nearest store"
 * is worse than saying it didn't work.
 *
 * `navigator.geolocation` is defined even where it cannot work — an insecure
 * origin, or a frame that was not granted the permission — so the guard below
 * catches only a browser without the API at all, and everything else arrives as
 * a real error with a code.
 *
 * **This is the cheap one, and it used to take a `precise` flag.** Both of its
 * callers — the boot pre-warm and "Nearest to me" — want somewhere to *order a
 * list* from, and over that question a network fix and a GPS fix give the same
 * answer: the nearest of eight shops does not change over a few hundred metres.
 * Waking a phone's GPS for it costs a second and a slice of battery for nothing,
 * on every visitor who ever granted the permission whether they ask for a route
 * or not. The one caller that needed better moved to `bestPosition`, so the flag
 * is deleted rather than defaulted — a parameter with one meaning left is not a
 * parameter.
 */
export function currentPosition(): Promise<Fix> {
  return new Promise((resolve, reject) => {
    const geo = navigator.geolocation;

    if (!geo) {
      reject(
        locationError("unsupported", "This browser can't share a location."),
      );
      return;
    }

    geo.getCurrentPosition(
      (position) => resolve(toFix(position)),
      (error) => reject(fromPositionError(error)),
      // A cached fix is fine for a list of distances, and five minutes of one
      // saves a lookup on every map load. It *can* reach a route's start —
      // `goToNearest` reports every reading to `remember` — which is why a `Fix`
      // carries the time it was taken and `betterFix` prefers a fresh reading
      // over a sharper-sounding stale one.
      { enableHighAccuracy: false, timeout: 10_000, maximumAge: 300_000 },
    );
  });
}
