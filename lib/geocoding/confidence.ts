import type { GeocodeStatus } from "@/lib/validation/place.schema";
import type { GeocodeCandidate } from "./types";

/**
 * Turning a geocoder's answer into "should a human look at this?".
 *
 * Photon returns no score, so precision has to be inferred from how specific the
 * matched feature is. A city centroid and a street address are both "results";
 * only one of them is where the shop is. Pure and dependency-free so the
 * thresholds can be tested directly.
 */

/** At or above this, we accept the result without flagging it. */
export const HIGH_CONFIDENCE = 0.8;

/**
 * How precisely the provider resolved the query, coarsest to finest. Photon
 * reports this in `properties.type`.
 */
export const PRECISION_CONFIDENCE = {
  house: 0.95,
  street: 0.7,
  locality: 0.55,
  district: 0.5,
  city: 0.4,
  county: 0.25,
  state: 0.15,
  country: 0.05,
} as const;

export type Precision = keyof typeof PRECISION_CONFIDENCE;

/** Unknown precision is treated as street-level minus a penalty, not as good. */
const UNKNOWN_CONFIDENCE = 0.45;

export function confidenceFor(
  precision: string | null | undefined,
  { hasHouseNumber = false }: { hasHouseNumber?: boolean } = {},
): number {
  const base =
    precision && precision in PRECISION_CONFIDENCE
      ? PRECISION_CONFIDENCE[precision as Precision]
      : UNKNOWN_CONFIDENCE;

  // A street match carrying the house number we asked for is effectively a
  // rooftop match; without one it is the middle of the road.
  if (hasHouseNumber && base < PRECISION_CONFIDENCE.house) {
    return Math.min(PRECISION_CONFIDENCE.house, base + 0.2);
  }

  return base;
}

/**
 * The status written to `places.geocodeStatus`.
 *
 * The return type excludes "manual" rather than being a plain GeocodeStatus:
 * "manual" is reserved for coordinates a person placed, and a geocoder result is
 * by definition not that (CLAUDE.md §7). Encoding it here means a caller can't
 * accidentally widen it back.
 */
export type GeocodedStatus = Exclude<GeocodeStatus, "manual">;

export function statusFor(
  candidate: GeocodeCandidate | null | undefined,
): GeocodedStatus {
  if (!candidate) return "failed";
  return candidate.confidence >= HIGH_CONFIDENCE ? "ok" : "low";
}

/** Rows a human has to look at before we save them. */
export function needsReview(status: GeocodeStatus): boolean {
  return status === "low" || status === "failed";
}
