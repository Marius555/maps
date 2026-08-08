import type { SnapshotPlace } from "@/packages/shared/snapshot";

import { button, el } from "./dom";

/**
 * Search and find-nearest, both entirely client-side.
 *
 * Search matches the places already in the snapshot — name, address, category
 * text — rather than geocoding what the visitor typed. Geocoding a visitor's
 * query would be a metered call in the visitor's path, which CLAUDE.md §2 rules
 * out; the geocoder runs once at import time and never again.
 *
 * Find-nearest uses the browser's own geolocation, which costs nothing and is
 * more accurate than resolving a typed address anyway.
 */

export function createSearchField(
  onQuery: (query: string) => void,
): HTMLElement {
  const wrapper = el("div", "lm-search");

  const label = el("label", "lm-visually-hidden", "Search locations");
  label.htmlFor = "lm-search-input";

  const input = el("input", "lm-search__input");
  input.id = "lm-search-input";
  input.type = "search";
  input.placeholder = "Search locations";
  input.autocomplete = "off";

  // Filtering a few thousand rows is cheap, so this runs per keystroke rather
  // than on submit — nothing is fetched, so there is nothing to throttle.
  input.addEventListener("input", () => onQuery(input.value));

  wrapper.append(label, input);

  return wrapper;
}

export function createNearestButton(onNearest: () => void): HTMLButtonElement {
  const control = button("lm-button", "Nearest to me");
  control.addEventListener("click", onNearest);

  return control;
}

export function matchesQuery(place: SnapshotPlace, query: string): boolean {
  const needle = query.trim().toLowerCase();
  if (!needle) return true;

  return (
    place.name.toLowerCase().includes(needle) ||
    (place.address?.toLowerCase().includes(needle) ?? false)
  );
}

/**
 * Geolocation, promisified.
 *
 * Rejects rather than falling back to an IP lookup: an IP-derived position can
 * be a hundred kilometres out, and silently showing the wrong "nearest store"
 * is worse than saying it didn't work.
 */
export function currentPosition(): Promise<{ lat: number; lng: number }> {
  return new Promise((resolve, reject) => {
    if (!navigator.geolocation) {
      reject(new Error("This browser can't share a location."));
      return;
    }

    navigator.geolocation.getCurrentPosition(
      (position) =>
        resolve({
          lat: position.coords.latitude,
          lng: position.coords.longitude,
        }),
      (error) => reject(new Error(error.message)),
      { enableHighAccuracy: false, timeout: 10_000, maximumAge: 300_000 },
    );
  });
}
