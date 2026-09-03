import "server-only";

import { createGeoapifyGeocoder } from "./geoapify";
import { createPhotonProvider } from "./photon";
import type { GeocodeProvider } from "./types";

/**
 * The only way the app gets a geocoder.
 *
 * One instance per process keeps the throttle meaningful — a new provider per
 * request would give every request its own empty queue and defeat the pacing.
 */
let provider: GeocodeProvider | null = null;

/**
 * `GEOCODER_PROVIDER=geoapify` moves geocoding onto Geoapify; anything else,
 * unset included, keeps Photon and every existing behaviour byte-identical.
 *
 * Independent of `ROUTING_PROVIDER` on purpose. They share an account and a
 * credit budget but not a decision: geocoding quality is judged on an import of
 * real addresses and routing on a drawn line, and one may be worth moving before
 * the other is.
 */
export function getGeocoder(): GeocodeProvider {
  provider ??=
    process.env.GEOCODER_PROVIDER === "geoapify"
      ? createGeoapifyGeocoder()
      : createPhotonProvider();

  return provider;
}

export { GeocoderError, isRetryable, isTimeout } from "./photon";
export { HIGH_CONFIDENCE, needsReview, statusFor } from "./confidence";
export type { GeocodeCandidate, GeocodeProvider, GeocodeQuery } from "./types";
