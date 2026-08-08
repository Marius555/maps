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

export type GeocodeCandidate = {
  lat: number;
  lng: number;
  /** One-line human-readable address, for the review step's list. */
  label: string;
  /**
   * 0–1. Derived by the adapter from how precisely the provider resolved the
   * query — see confidence.ts. It is a comparable signal, not a probability.
   */
  confidence: number;
};

export type GeocodeQuery = {
  address: string;
  /** ISO 3166-1 alpha-2, when the import is known to be single-country. */
  countryCode?: string;
  limit?: number;
};

export type GeocodeProvider = {
  /** Identifies the provider in logs and in the review step's footnote. */
  readonly name: string;
  search(query: GeocodeQuery): Promise<GeocodeCandidate[]>;
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
