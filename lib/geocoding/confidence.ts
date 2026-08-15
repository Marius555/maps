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

/**
 * How far a reverse match may be from the pin before it stops being about it.
 *
 * Precision alone says how *specific* a feature is, never how *near*. That is
 * fine for a forward search, where the query is text and there is no coordinate
 * to be near — but it is exactly wrong for a dropped pin, where a `house` feature
 * a hundred metres away on the next street scored 0.95, the same as the building
 * the pin is standing on. That is the "wrong street, stated confidently" bug: it
 * looked answered, so nobody checked it.
 *
 * Inside `NEAR_M` the match is about this pin and keeps its full score. Past
 * `FAR_M` it is about somewhere else, and retains `FAR_FACTOR` of it — reduced,
 * not zeroed, because the street is usually still right even when the building
 * isn't. Between the two it tapers, so nothing flips at a threshold.
 */
const NEAR_M = 10;
const FAR_M = 150;
const FAR_FACTOR = 0.45;

export function confidenceFor(
  precision: string | null | undefined,
  {
    hasHouseNumber = false,
    distanceM,
  }: { hasHouseNumber?: boolean; distanceM?: number } = {},
): number {
  const base =
    precision && precision in PRECISION_CONFIDENCE
      ? PRECISION_CONFIDENCE[precision as Precision]
      : UNKNOWN_CONFIDENCE;

  // A street match carrying the house number we asked for is effectively a
  // rooftop match; without one it is the middle of the road.
  const promoted =
    hasHouseNumber && base < PRECISION_CONFIDENCE.house
      ? Math.min(PRECISION_CONFIDENCE.house, base + 0.2)
      : base;

  return promoted * distanceFactor(distanceM);
}

/**
 * 1 when the match is on top of the pin, `FAR_FACTOR` when it is far away.
 *
 * An omitted distance is not "distance zero" — a forward search has no pin to
 * measure against, and penalising it would be inventing a fact. It returns 1 so
 * `search()` scores exactly as it did before this existed.
 */
function distanceFactor(distanceM: number | undefined): number {
  if (distanceM === undefined || !Number.isFinite(distanceM)) return 1;
  if (distanceM <= NEAR_M) return 1;
  if (distanceM >= FAR_M) return FAR_FACTOR;

  const travelled = (distanceM - NEAR_M) / (FAR_M - NEAR_M);
  return 1 - travelled * (1 - FAR_FACTOR);
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

/**
 * A pin someone placed themselves whose *address* only reached the street.
 *
 * The opposite failure from `needsReview`, and the distinction is the whole point:
 * there the position is suspect and the fix is to drag the pin. Here the position
 * is exactly right — a person put it there — and it is the address read back off
 * the map that is short a house number, because reverse geocoding only reaches a
 * building when the pin is standing on one.
 *
 * Only for "manual". An "ok" row was geocoded from a full address the customer
 * typed and already carries its number; flagging it on the same threshold would
 * mark rows that are exactly as precise as we promised.
 */
export function isApproximate(
  status: GeocodeStatus,
  confidence: number | null | undefined,
): boolean {
  return (
    status === "manual" &&
    typeof confidence === "number" &&
    confidence < HIGH_CONFIDENCE
  );
}
