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
 * distance maths: the composing lives
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
   * find-nearest, when the map ships one.
   *
   * The slot it takes used to hold a magnifier that did nothing (`pointer-events:
   * none`, a picture), while the one live control next to it spent a whole 34px
   * of a toolbar that is short of room at exactly the widths the drawer exists
   * for. A field that says "search" by having a search control in it says more
   * than one that says it with a drawing.
   *
   * Absent, the magnifier is drawn instead: a map with Nearest switched off
   * still has to read as a search box rather than a bare text input.
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

  /*
   * Inside the field, at the end of it — a control if the caller passed one,
   * and otherwise a magnifier.
   *
   * Either way it is at the *end* rather than the start, because the placeholder
   * is a sentence and a leading glyph pushes it far enough right that a narrow
   * panel truncates it.
   *
   * The magnifier is a picture, not a button: `pointer-events: none` in the
   * stylesheet keeps the whole field clickable through it, since the one thing
   * worse than no icon in an input is a dead patch at the end of the box
   * somebody is trying to click into. A real control does not want that, which
   * is why the two share a position and not a class.
   */
  const trailing =
    action ??
    icon(["M21 21l-4.3-4.3", "M11 19a8 8 0 1 0 0-16 8 8 0 0 0 0 16"]);
  if (!action) trailing.classList.add("lm-search__icon");

  wrapper.append(label, input, trailing, list);

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

  setNearestOn(control, false);
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
 * Lit, or not — and what a press means in each state.
 *
 * `aria-pressed` rather than a class alone: a control that has two states has to
 * say so to something that cannot see the colour, and a toggle button is exactly
 * what this now is. The name changes with it, because "Nearest to me" on a
 * button that clears the origin is a control that lies about what it does.
 */
export function setNearestOn(control: HTMLButtonElement, on: boolean): void {
  const label = on ? "Stop measuring from here" : "Nearest to me";

  control.classList.toggle("lm-button--on", on);
  control.setAttribute("aria-pressed", String(on));
  control.setAttribute("aria-label", label);
  control.title = label;
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
 * Where the browser says the visitor is, and how sure it is.
 *
 * `accuracy` is the radius in metres the browser claims, and it is carried
 * because the two things that ask for a position want different answers about a
 * vague one. Sorting a list by distance is useful from a city-level fix — the
 * nearest of eight shops does not change over a kilometre — while a route's
 * start wants the sharpest reading of the session, which is what `betterFix`
 * below picks and `me` in ./index.ts holds.
 *
 * `timestamp` is the browser's own, straight off `GeolocationPosition`, and it
 * is here because **a reading can be sharp and still be wrong**: `currentPosition`
 * accepts a cached fix up to five minutes old, and without an age to compare
 * against, one of those permanently outranks every fresh reading that follows it
 * purely by claiming a smaller radius. See `betterFix`.
 */
export type Fix = {
  lat: number;
  lng: number;
  accuracy: number;
  timestamp: number;
};

/**
 * Past this, a reading is describing where somebody *was*.
 *
 * It only has to be shorter than `currentPosition`'s `maximumAge` of five
 * minutes, which is the one thing in this file that can hand back a fix old
 * enough to be somewhere else entirely.
 */
const STALE_AFTER_MS = 60_000;

/**
 * Which of two readings a route should start from — the session's answer to
 * "where is the visitor", decided one arrival at a time.
 *
 * **Fresh beats sharp, and that ordering is the whole point of this function.**
 * Comparing on `accuracy` alone is what it used to do, and it has a failure that
 * looks exactly like a correct answer: the crosshair takes a deliberately cheap
 * cached fix (`currentPosition`, `maximumAge: 300_000`), so a reading taken five
 * minutes and one commute ago can arrive claiming a tighter radius than the
 * warm-up's live one — and then hold `me` for the rest of the session, sending
 * every Directions link to a confidently wrong street.
 *
 * Among readings of comparable age the sharper one wins, and **ties go to the
 * newcomer** so a visitor who has actually moved is followed.
 */
export function betterFix(current: Fix | null, next: Fix): Fix {
  if (!current) return next;

  const now = Date.now();
  const nextIsFresh = now - next.timestamp <= STALE_AFTER_MS;
  const currentIsFresh = now - current.timestamp <= STALE_AFTER_MS;

  // Only when exactly one of them is fresh; if both are stale there is nothing
  // better to be had and accuracy is still the best question to ask.
  if (nextIsFresh !== currentIsFresh) return nextIsFresh ? next : current;

  return next.accuracy <= current.accuracy ? next : current;
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

/**
 * How long to keep listening for a sharper reading.
 *
 * Nobody is ever blocked on this — both callers are fire-and-forget, which is
 * the correction this number's whole existence came out of. It was once spent
 * with a visitor watching an open blank tab, and three seconds of that is five
 * seconds of a broken-looking product.
 */
const SETTLE_MS = 3000;

/**
 * Sharp enough that a better reading would change nothing anyone can see, so
 * the watch stops rather than running out its window. A GPS fix is 5–20m.
 */
const SHARP_ENOUGH_M = 20;

/**
 * The *best* reading the browser can give within a window — the route's start.
 *
 * **`getCurrentPosition` resolves on the first reading that satisfies the
 * options, and on a phone the first reading is the network fix.** The GPS one
 * lands a second or two later and is ten times better, and nothing that calls
 * `getCurrentPosition` ever sees it. That is the whole reason this exists:
 * `watchPosition` is handed every refinement, so keeping the sharpest one for a
 * couple of seconds is the one change that actually improves the number a
 * visitor is routed from.
 *
 * Resolves early the moment a reading is good enough to be used as-is
 * (`goodEnough`), because past that a better one changes nothing downstream and
 * the caller is sitting on an open, blank tab while it waits.
 *
 * Two rules about failure, and both are the difference between this and a
 * promisified `watchPosition`:
 *
 * - **A refusal ends it immediately.** Sitting out the window after a
 *   `PERMISSION_DENIED` is three seconds of a blank tab for an answer already
 *   given.
 * - **Any other error is one failed reading, not the outcome.** A later reading
 *   may still succeed, and one already taken is not undone by it — so it only
 *   decides anything if the window closes with nothing to show.
 */
export function bestPosition(
  withinMs = SETTLE_MS,
  goodEnough = SHARP_ENOUGH_M,
  /**
   * Told about every reading the moment it arrives, sharp or not.
   *
   * Without it the caller learns nothing until the window closes, so a
   * visitor pressing a second Directions link two seconds after the first
   * still has no origin — the warm-up is running and has an answer it is
   * sitting on. Safe to hand every reading to, because the one thing that
   * consumes this (`remember` in ./index.ts) keeps the sharpest of them and
   * a worse one arriving later changes nothing.
   */
  onReading?: (at: Fix) => void,
): Promise<Fix> {
  return new Promise((resolve, reject) => {
    const geo = navigator.geolocation;

    if (!geo) {
      reject(
        locationError("unsupported", "This browser can't share a location."),
      );
      return;
    }

    let best: Fix | null = null;
    let failure: LocationError | null = null;
    let watch: number | null = null;

    const stop = () => {
      if (watch !== null) geo.clearWatch(watch);
      // Null rather than left set: `settle` can run from the timer and from a
      // reading in the same tick, and clearing a watch id twice is a browser
      // clearing somebody else's watch.
      watch = null;
      clearTimeout(timer);
    };

    const settle = () => {
      stop();

      if (best) resolve(best);
      else reject(failure ?? locationError("timeout", "Locating timed out."));
    };

    // Below `stop`, which closes over it: the closure is only ever *called*
    // after this line has run, so the reference resolves fine.
    const timer = setTimeout(settle, withinMs);

    watch = geo.watchPosition(
      (position) => {
        const fix = toFix(position);
        onReading?.(fix);
        if (!best || fix.accuracy < best.accuracy) best = fix;

        if (best.accuracy <= goodEnough) settle();
      },
      (error) => {
        if (error.code === error.PERMISSION_DENIED) {
          stop();
          reject(fromPositionError(error));
          return;
        }

        failure ??= fromPositionError(error);
      },
      { enableHighAccuracy: true, timeout: 10_000, maximumAge: 0 },
    );
  });
}

function toFix(position: GeolocationPosition): Fix {
  return {
    lat: position.coords.latitude,
    lng: position.coords.longitude,
    accuracy: position.coords.accuracy,
    // The browser's own, never `Date.now()`: a cached reading is handed back
    // with the time it was *taken*, and that gap is the entire signal
    // `betterFix` exists to read.
    timestamp: position.timestamp,
  };
}

function fromPositionError(error: GeolocationPositionError): LocationError {
  return locationError(
    error.code === error.PERMISSION_DENIED
      ? "denied"
      : error.code === error.TIMEOUT
        ? "timeout"
        : "unavailable",
    error.message,
  );
}
