/**
 * The geocoding boundary (CLAUDE.md §7).
 *
 * Everything outside /lib/geocoding talks to `GeocodeProvider` and nothing else.
 * We expect to move between a hosted Photon instance and our own, and a provider
 * SDK imported anywhere else would make that a rewrite instead of a config change.
 *
 * Pure types and pure functions only in this file — no `server-only`, so the
 * shapes can be shared with tests and, in Week 3, with the embed's own types.
 */

import type { AddressParts } from "@/lib/validation/place.schema";

export type { AddressParts };

export type GeocodeCandidate = {
  lat: number;
  lng: number;
  /** One-line human-readable address, for the review step's list. */
  label: string;
  /**
   * The same place, short enough to be a heading: street and house number, then
   * the town. `label` carries the postcode and country as well, which is right
   * for disambiguating two search results and wrong for a row title.
   */
  title: string;
  /**
   * 0–1. Derived by the adapter from how precisely the provider resolved the
   * query — see confidence.ts. It is a comparable signal, not a probability.
   */
  confidence: number;
  /**
   * The same address before it was joined into `label` and `title`.
   *
   * Kept because the pieces outlive the sentence: the locations list shows the
   * postcode on its own line, and a row that stored only the formatted string
   * would have to be geocoded again to get it back.
   */
  parts?: AddressParts;
};

export type GeocodeQuery = {
  address: string;
  /** ISO 3166-1 alpha-2, when the import is known to be single-country. */
  countryCode?: string;
  limit?: number;
};

export type ReverseGeocodeQuery = {
  lat: number;
  lng: number;
  /**
   * The street the caller measured off the basemap's own tiles, if it had a map
   * to measure against.
   *
   * The provider cannot work this out for itself: Photon publishes a bounding box
   * per feature and never a polygon or a centreline, so a pin on the pavement
   * falls inside the box of the block beside it and inherits a street it is
   * nowhere near. A real centreline settles it. Optional throughout — a CSV
   * import has no map, and the provider must still answer.
   */
  road?: { names: string[]; distanceM: number } | null;
};

export type GeocodeProvider = {
  /** Identifies the provider in logs and in the review step's footnote. */
  readonly name: string;
  search(query: GeocodeQuery): Promise<GeocodeCandidate[]>;
  /**
   * Coordinates → the address there, or null if the provider has nothing.
   *
   * This runs when someone drops a pin in the editor, which is a dashboard action
   * — never a visitor one. CLAUDE.md §2's rule is about the visitor's path, and
   * this is on the far side of it.
   */
  reverse(query: ReverseGeocodeQuery): Promise<GeocodeCandidate | null>;
};

/**
 * One row's result from the batch endpoint.
 *
 * Lives here rather than beside the route handler so the client can import the
 * shape without importing a server route module.
 */
export type BatchGeocodeResult = {
  /** Echoes the client's row key so the result reattaches to its row. */
  key: string;
  /** Best match, or null when nothing was found. */
  candidate: GeocodeCandidate | null;
  /** Every other candidate, so the review step can offer alternatives. */
  alternatives: GeocodeCandidate[];
  /** One of the `places.geocodeStatus` values — never "manual". */
  status: "ok" | "low" | "failed";
};
