import "server-only";

import { confidenceFor } from "./confidence";
import { createThrottle } from "./throttle";
import type { GeocodeCandidate, GeocodeProvider, GeocodeQuery } from "./types";

/**
 * Photon adapter (CLAUDE.md §12).
 *
 * Photon is the geocoder we intend to self-host — prebuilt GraphHopper dumps on
 * their own VPS. Pointing `GEOCODER_URL` at that instance is the only change
 * needed, because the API is identical. Nominatim is deliberately not implemented:
 * its public terms forbid bulk use, which is exactly what a CSV import is.
 *
 * The public komoot instance is a development convenience with no uptime
 * guarantee, same caveat as OpenFreeMap tiles.
 */

const DEFAULT_ENDPOINT = "https://photon.komoot.io";

/**
 * ~1 req/sec. Courtesy pace for a shared public instance; a self-hosted one can
 * take far more, which is why it is read from the environment.
 */
const DEFAULT_MIN_INTERVAL_MS = 1000;

const REQUEST_TIMEOUT_MS = 8000;

type PhotonFeature = {
  geometry?: { coordinates?: [number, number] };
  properties?: {
    type?: string;
    name?: string;
    housenumber?: string;
    street?: string;
    postcode?: string;
    city?: string;
    district?: string;
    state?: string;
    country?: string;
  };
};

export function createPhotonProvider(options?: {
  endpoint?: string;
  minIntervalMs?: number;
}): GeocodeProvider {
  const endpoint = (
    options?.endpoint ??
    process.env.GEOCODER_URL ??
    DEFAULT_ENDPOINT
  ).replace(/\/$/, "");

  const throttle = createThrottle(
    options?.minIntervalMs ?? readInterval() ?? DEFAULT_MIN_INTERVAL_MS,
  );

  return {
    name: "photon",

    async search({ address, countryCode, limit = 5 }: GeocodeQuery) {
      const trimmed = address.trim();
      if (!trimmed) return [];

      const url = new URL(`${endpoint}/api`);
      // Photon has no country filter parameter, so a country hint goes into the
      // query text itself, which its ranking does use. Faking a filter param
      // would silently do nothing.
      url.searchParams.set("q", countryCode ? `${trimmed}, ${countryCode}` : trimmed);
      url.searchParams.set("limit", String(limit));
      url.searchParams.set("lang", "en");

      return throttle(async () => {
        const response = await fetch(url, {
          // Geocoding happens at import time, never at view time, so this is
          // never in a visitor's path (CLAUDE.md §2).
          cache: "no-store",
          signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
          headers: { accept: "application/json" },
        });

        if (!response.ok) {
          throw new GeocoderError(
            `Photon returned ${response.status}`,
            response.status,
          );
        }

        const body = (await response.json()) as { features?: PhotonFeature[] };

        return (body.features ?? [])
          .map(toCandidate)
          .filter((candidate): candidate is GeocodeCandidate => candidate !== null);
      });
    },
  };
}

/** An unset or non-numeric value falls through to the default, not to NaN. */
function readInterval(): number | undefined {
  const raw = process.env.GEOCODER_MIN_INTERVAL_MS;
  if (!raw) return undefined;

  const parsed = Number(raw);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : undefined;
}

/** Thrown for an upstream failure, so the route can tell it from a bad request. */
export class GeocoderError extends Error {
  constructor(
    message: string,
    readonly status?: number,
  ) {
    super(message);
    this.name = "GeocoderError";
  }
}

function toCandidate(feature: PhotonFeature): GeocodeCandidate | null {
  const coordinates = feature.geometry?.coordinates;
  if (!coordinates || coordinates.length < 2) return null;

  const [lng, lat] = coordinates;
  if (!Number.isFinite(lng) || !Number.isFinite(lat)) return null;

  const properties = feature.properties ?? {};

  return {
    lat,
    lng,
    label: formatLabel(properties),
    confidence: confidenceFor(properties.type, {
      hasHouseNumber: Boolean(properties.housenumber),
    }),
  };
}

/**
 * Photon returns address parts, not a formatted line. Joined here so the review
 * step and the place's `address` field show the same string.
 */
function formatLabel(properties: NonNullable<PhotonFeature["properties"]>): string {
  const street = [properties.street, properties.housenumber]
    .filter(Boolean)
    .join(" ");

  // `name` duplicates the street for address-type results — keep it only when it
  // adds something, like a venue name.
  const leading = properties.name && properties.name !== street ? properties.name : "";

  return [
    leading,
    street,
    properties.postcode,
    properties.city ?? properties.district,
    properties.country,
  ]
    .filter(Boolean)
    .join(", ");
}
