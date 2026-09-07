import "server-only";

import {
  GeoapifyError,
  geoapifyGet,
  geoapifyPaceMs,
} from "@/lib/geoapify/client";
import { matchesRoad } from "@/lib/map/nearest-road";
import type { AddressParts } from "@/lib/validation/place.schema";
import { PRECISION_CONFIDENCE, confidenceFor, type Precision } from "./confidence";
import { GeocoderError } from "./photon";
import { REVERSE_MAX_DISTANCE_M } from "./reverse-select";
import type {
  GeocodeCandidate,
  GeocodeProvider,
  GeocodeQuery,
  ReverseGeocodeQuery,
} from "./types";

/**
 * Geoapify adapter.
 *
 * The hosted answer to what CLAUDE.md §12 records about `photon.komoot.io`:
 * "extensive usage will be throttled or completely banned", and a CSV import is
 * extensive usage. Geoapify permits commercial use and permits results to be
 * stored, which is what this app does with them — a geocode is written to the row
 * once and never asked again, because asking at view time is what §2 forbids
 * outright.
 *
 * Selected by `GEOCODER_PROVIDER=geoapify`; unset, `lib/geocoding/index.ts`
 * builds the Photon adapter and nothing here runs.
 *
 * **This adapter does not use reverse-select.ts, and that is not an oversight.**
 * Those 416 lines exist because Photon publishes a bounding box per feature and
 * never a polygon or a centreline, so the nearest returned object is routinely
 * the wrong one and the right answer has to be reconstructed from boxes.
 * Geoapify reports `distance` and `result_type` per feature directly, which is
 * the fact that file works to recover. What is kept is the two judgements that
 * are ours rather than Photon's: the distance past which nothing found is an
 * answer about this pin, and the basemap's own road centreline as the tiebreak.
 */

export function createGeoapifyGeocoder(): GeocodeProvider {
  return {
    name: "geoapify",
    // The shared client's, not a second number here: geocoding and routing pace
    // themselves out of one throttle because one account has one rate limit.
    paceMs: geoapifyPaceMs(),

    async search({ address, countryCode, limit = 5 }: GeocodeQuery) {
      const trimmed = address.trim();
      if (!trimmed) return [];

      const params = new URLSearchParams({
        text: trimmed,
        limit: String(limit),
        lang: "en",
      });

      // A real filter parameter, unlike Photon's — where a country hint has to be
      // appended to the query text because no such parameter exists.
      if (countryCode) {
        params.set("filter", `countrycode:${countryCode.toLowerCase()}`);
      }

      const body = await ask<GeoapifyResponse>("/v1/geocode/search", params);

      return (body.features ?? [])
        .map((feature) => toCandidate(feature.properties))
        .filter((candidate): candidate is GeocodeCandidate => candidate !== null);
    },

    /**
     * The address at a dropped pin.
     *
     * **Two requests, and the second one is not optional.** Measured against the
     * live API: an unfiltered reverse at a pin on Gedimino pr. returned twenty
     * features, every one of them a `building` or an `amenity` and not one a
     * street — the nearest being a block 33m away across the road, addressed
     * "V. Kudirkos a. 11B". The street the pin is actually 8m from is reachable
     * only by asking for it with `type=street`. So the nearest thing and the
     * nearest street are two questions, they cost a request each, and answering
     * only the first is how a pin gets filed under a street it is nowhere near
     * with a house number nobody placed. That is the bug reverse-select.ts was
     * written about; it is a property of how addresses work rather than of
     * Photon, and it reproduces here exactly.
     *
     * The second request is skipped in the one case it cannot change the answer:
     * a pin standing on a building, with nothing from the tiles contradicting it.
     * That is the common case — someone marking their own shop — so the usual
     * cost is still one request.
     *
     * `road` is the street measured off the basemap's own vector tiles, and it is
     * still the only real road geometry in the system whatever the geocoder is
     * (lib/map/nearest-road.ts).
     */
    async reverse({ lat, lng, road }: ReverseGeocodeQuery) {
      if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;

      const at = { lat: String(lat), lon: String(lng), lang: "en" };

      const near = await ask<GeoapifyResponse>(
        "/v1/geocode/reverse",
        new URLSearchParams({ ...at, limit: String(REVERSE_CANDIDATE_LIMIT) }),
      );

      const buildings = (near.features ?? [])
        .map((feature) => feature.properties)
        .filter((properties): properties is GeoapifyProperties => Boolean(properties));

      const street = needsStreet(buildings, road)
        ? ((
            await ask<GeoapifyResponse>(
              "/v1/geocode/reverse",
              new URLSearchParams({ ...at, type: "street", limit: "1" }),
            )
          ).features?.[0]?.properties ?? null)
        : null;

      const properties = selectReverse(buildings, street, road);
      if (!properties) return null;

      const candidate = toCandidate(properties);
      if (!candidate) return null;

      return {
        ...candidate,
        /*
         * The pin's own coordinates, not the matched feature's. The candidate
         * describes where the user put the pin; handing back the centroid of the
         * street it stands on would invite a caller to snap the pin there, which
         * is the one thing a person who just placed it did not ask for.
         */
        lat,
        lng,
      };
    },
  };
}

/**
 * Enough features to choose among, and no more.
 *
 * Photon's adapter asks for thirty because it is weighing bounding boxes and
 * needs the whole neighbourhood to do it. Here the only choice being made is
 * whether a nearer feature disagrees with the tiles about which street this is,
 * which the closest handful settles.
 */
const REVERSE_CANDIDATE_LIMIT = 8;

/** Geoapify's properties, narrowed to what we read. */
export type GeoapifyProperties = {
  lat?: number;
  lon?: number;
  formatted?: string;
  address_line1?: string;
  address_line2?: string;
  name?: string;
  housenumber?: string;
  street?: string;
  postcode?: string;
  city?: string;
  district?: string;
  suburb?: string;
  state?: string;
  country?: string;
  country_code?: string;
  result_type?: string;
  /** Reverse only: metres from the queried coordinate to this feature. */
  distance?: number;
  rank?: { confidence?: number; match_type?: string };
  place_id?: string;
};

export type GeoapifyResponse = {
  features?: Array<{ properties?: GeoapifyProperties }>;
  statusCode?: number;
  error?: string;
  message?: string;
};

/**
 * How near a building has to be before the pin is standing on it rather than
 * beside it.
 *
 * The same number and the same reasoning as `POINT_HIT_M` in reverse-select.ts:
 * a feature is reported at one coordinate, so containment is not available and
 * proximity is all there is. Within ten metres of a building's own point you are
 * at that building, and no street can be a better answer — which is what makes
 * the second request skippable in the common case.
 */
const ON_SITE_M = 10;

/**
 * Whether the nearest street has to be asked for as well.
 *
 * No, only when a building is near enough to be the thing the pin is standing on
 * *and* nothing from the tiles says otherwise. A building that disagrees with the
 * road the tiles measured is exactly the case the street request exists to
 * settle, however near it is.
 */
export function needsStreet(
  buildings: readonly GeoapifyProperties[],
  road?: ReverseGeocodeQuery["road"],
): boolean {
  const nearest = buildings[0];
  if (!nearest) return true;
  if ((nearest.distance ?? Number.POSITIVE_INFINITY) > ON_SITE_M) return true;

  return Boolean(road) && !matchesRoad(nearest.street, road);
}

/**
 * Which of the reverse results is the address at the pin.
 *
 * Three rules, in order, and they are reverse-select.ts's rules restated against
 * a provider that reports distances instead of bounding boxes:
 *
 * 1. **What the tiles say.** If they name the road the pin is on, the candidate
 *    addressed on that road wins however the distances fall — they carry the
 *    road's real centreline and the geocoder carries a point.
 * 2. **The thing the pin is standing on.** A building at least as near as the
 *    street is what the person marking their shop meant, house number included.
 * 3. **Otherwise the nearest street**, without a number. We do not borrow the
 *    house number of a building across the road: a number nobody placed is a
 *    guess, and a guessed number looks answered, so nobody checks it.
 *
 * Past `REVERSE_MAX_DISTANCE_M` nothing found is an answer about this pin, and
 * the honest reply is none: the row then says "Couldn't find an address" and
 * offers a retry, which is a small piece of work rather than a quiet lie.
 */
export function selectReverse(
  buildings: readonly GeoapifyProperties[],
  street: GeoapifyProperties | null,
  road?: ReverseGeocodeQuery["road"],
): GeoapifyProperties | null {
  const agreeing = road
    ? [...buildings, ...(street ? [street] : [])].find((properties) =>
        matchesRoad(properties.street ?? properties.name, road),
      )
    : undefined;

  const chosen = agreeing ?? nearestOf(buildings[0], street);
  if (!chosen) return null;

  // An absent distance is not "distance zero" — every reverse feature carries
  // one, so a missing value means a response shape we do not recognise, and
  // refusing is the safe side to fail on.
  const distance = chosen.distance;
  if (typeof distance !== "number" || distance > REVERSE_MAX_DISTANCE_M) return null;

  return chosen;
}

/** The building when it is at least as near as the street, else the street. */
function nearestOf(
  building: GeoapifyProperties | undefined,
  street: GeoapifyProperties | null,
): GeoapifyProperties | undefined {
  if (!building) return street ?? undefined;
  if (!street) return building;

  const here = building.distance ?? Number.POSITIVE_INFINITY;
  const road = street.distance ?? Number.POSITIVE_INFINITY;

  return here <= road ? building : street;
}

/**
 * Geoapify's `result_type` → the precision ladder confidence.ts already scores.
 *
 * Deliberately *not* `rank.confidence`, which Geoapify reports as its own 0–1
 * number. `HIGH_CONFIDENCE`, `needsReview` and `statusFor` are all calibrated
 * against `PRECISION_CONFIDENCE`'s values, and `confidence.test.ts` pins them —
 * so passing a differently-scaled score straight through would silently re-decide
 * which rows the import review step flags, which is the one place in this app a
 * wrong number is invisible until a customer's map is already wrong.
 */
const RESULT_PRECISION: Record<string, Precision> = {
  building: "house",
  amenity: "house",
  street: "street",
  locality: "locality",
  district: "district",
  suburb: "district",
  // Finer than a city almost everywhere and coarser than a street everywhere, so
  // it sits on `district`. Either way it is well below HIGH_CONFIDENCE, which is
  // what decides whether a human is asked to look.
  postcode: "district",
  city: "city",
  county: "county",
  state: "state",
  country: "country",
};

/**
 * How coarsely the *query* matched, which is a different question from how
 * specific the returned feature is.
 *
 * Asking for "12 Fake Street, Vilnius" and being handed a street feature that was
 * only reached by matching the city is a street-shaped answer to a question that
 * was not answered. Geoapify says so in `rank.match_type`; without reading it,
 * that result scores 0.7 and sails past the review step. The cap is applied by
 * taking whichever of the two precisions scores lower.
 */
const MATCH_CEILING: Record<string, Precision> = {
  match_by_street: "street",
  match_by_postcode: "district",
  match_by_city_or_district: "city",
  match_by_country_or_state: "state",
};

/**
 * Geoapify's own doubt about the match, applied on top of the precision ladder.
 *
 * The ladder alone says how *specific* a result is, never whether it is real.
 * Measured against the live API: "Gedimino pr. 99999, Vilnius" — a house number
 * that does not exist — comes back as `result_type: "building"` with
 * `match_type: "full_match"`, which scores 0.95 and is accepted without review.
 * Geoapify is not claiming otherwise; it says so in `rank.confidence`, which is
 * 0.5 for that result and 1 for the real number next door. Ignoring it entirely
 * was the wrong half of "do not pass a differently-calibrated score through".
 *
 * A multiplier rather than a replacement, so the thresholds `confidence.test.ts`
 * pins keep meaning what they mean: a result Geoapify is sure of scores exactly
 * what the ladder says, and doubt can only ever push a row *towards* the review
 * step. Absent — Photon-shaped responses, and reverse results, carry no rank —
 * is no penalty rather than no confidence.
 */
function rankFactor(properties: GeoapifyProperties): number {
  const confidence = properties.rank?.confidence;
  if (typeof confidence !== "number" || !Number.isFinite(confidence)) return 1;

  return Math.min(1, Math.max(0, confidence));
}

export function precisionFor(properties: GeoapifyProperties): Precision | null {
  const base = properties.result_type
    ? RESULT_PRECISION[properties.result_type]
    : undefined;

  const ceiling = properties.rank?.match_type
    ? MATCH_CEILING[properties.rank.match_type]
    : undefined;

  if (!base) return ceiling ?? null;
  if (!ceiling) return base;

  return PRECISION_CONFIDENCE[ceiling] < PRECISION_CONFIDENCE[base] ? ceiling : base;
}

/**
 * One Geoapify feature, turned into a candidate.
 *
 * Exported and pure for the reason `formatLabel` and `toAddressParts` are in the
 * Photon adapter: the mapping *is* this adapter's behaviour, and it is
 * unreachable through `search` without a network round trip.
 */
export function toCandidate(
  properties: GeoapifyProperties | undefined,
): GeocodeCandidate | null {
  if (!properties) return null;

  const { lat, lon } = properties;
  if (!Number.isFinite(lat) || !Number.isFinite(lon)) return null;

  return {
    lat: lat as number,
    lng: lon as number,
    label: formatLabel(properties),
    title: formatTitle(properties),
    confidence:
      confidenceFor(precisionFor(properties), {
        hasHouseNumber: Boolean(properties.housenumber),
        // Present on reverse results and absent on forward ones, which is exactly
        // what `confidenceFor` expects: a text search has no pin to be near.
        distanceM: properties.distance,
      }) * rankFactor(properties),
    parts: toAddressParts(properties),
  };
}

/**
 * Geoapify's properties → the parts we keep, renamed to this codebase's spelling.
 *
 * A copy rather than the raw object, for the reason `toAddressParts` in photon.ts
 * gives: storing a provider's wire shape verbatim makes the swap §7 plans for a
 * migration instead of a config change. Empty fields are dropped rather than
 * stored as "", so a row with no postcode says so by not having one.
 *
 * There is no `osmType`/`osmId` here. Geoapify reports a `place_id` of its own
 * instead, which is not an OSM object id and must not be written into fields that
 * promise one — a row traced back through it would resolve to nothing.
 */
export function toAddressParts(properties: GeoapifyProperties): AddressParts {
  const parts: AddressParts = {};

  const copy: Array<[keyof AddressParts, string | undefined]> = [
    ["housenumber", properties.housenumber],
    ["street", properties.street],
    ["postcode", properties.postcode],
    ["city", properties.city],
    ["district", properties.district ?? properties.suburb],
    ["state", properties.state],
    ["country", properties.country],
    ["countryCode", properties.country_code?.toUpperCase()],
    ["name", properties.name],
  ];

  for (const [key, value] of copy) {
    if (value === undefined || value === "") continue;
    parts[key] = value;
  }

  return parts;
}

/** "Gedimino pr." + "1" → "Gedimino pr. 1". Empty when neither part is present. */
function streetLine(properties: GeoapifyProperties): string {
  return [properties.street, properties.housenumber].filter(Boolean).join(" ");
}

/**
 * The one-line address, for the review step's list.
 *
 * Geoapify composes this itself, which Photon does not — `formatted` is the
 * display address and is better at it than a join of our own would be, because it
 * knows that a house number leads in Vilnius and follows in London. The fallback
 * exists only for a feature that arrives without one.
 */
export function formatLabel(properties: GeoapifyProperties): string {
  if (properties.formatted) return properties.formatted;

  return [
    properties.name !== streetLine(properties) ? properties.name : "",
    streetLine(properties),
    properties.postcode,
    properties.city ?? properties.district,
    properties.country,
  ]
    .filter(Boolean)
    .join(", ");
}

/**
 * The short form: street, house number and town, no postcode and no country.
 *
 * Composed rather than taken from `address_line1`, which Geoapify fills with the
 * *amenity name* when there is one. That is the bug photon.ts's `formatTitle`
 * documents at length: a pin dropped on the Vytautas Kasiulis Museum of Art read
 * "Vytautas Kasiulis Museum of Art, Vilnius" — memorable, and not an address.
 * This line has to say *where* the place is, because it is the only line that
 * does. The name is not thrown away; `toAddressParts` keeps it and the locations
 * list prints it after the postcode.
 *
 * A venue with no street at all — a park, a bridge, a mountain — still leads with
 * its name, because then the name is the most locating thing there is.
 */
export function formatTitle(properties: GeoapifyProperties): string {
  const leading = streetLine(properties) || properties.name || "";
  const town = properties.city ?? properties.district ?? properties.state ?? "";

  const title = [leading, town].filter(Boolean).join(", ");

  return title || formatLabel(properties);
}

/**
 * One Geoapify request, with its failures translated into this folder's error.
 *
 * `lib/api/geocoder-errors.ts` recognises `GeocoderError` and re-throws anything
 * else as a bug, so a `GeoapifyError` reaching it would report an upstream
 * timeout as a 500. The cause travels with it because `isTimeout` reads it.
 */
async function ask<T>(path: string, params: URLSearchParams): Promise<T> {
  try {
    return await geoapifyGet<T>(path, params);
  } catch (error) {
    if (error instanceof GeoapifyError) {
      throw new GeocoderError(error.message, error.status, error.cause);
    }

    throw error;
  }
}
