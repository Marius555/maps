import "server-only";

import { createPhotonProvider } from "./photon";
import type { GeocodeProvider } from "./types";

/**
 * The only way the app gets a geocoder.
 *
 * One instance per process keeps the throttle meaningful — a new provider per
 * request would give every request its own empty queue and defeat the pacing.
 */
let provider: GeocodeProvider | null = null;

export function getGeocoder(): GeocodeProvider {
  provider ??= createPhotonProvider();
  return provider;
}

export { GeocoderError, isRetryable, isTimeout } from "./photon";
export { HIGH_CONFIDENCE, needsReview, statusFor } from "./confidence";
export type { GeocodeCandidate, GeocodeProvider, GeocodeQuery } from "./types";
