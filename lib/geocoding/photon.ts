import "server-only";

import { confidenceFor } from "./confidence";
import type { PhotonFeature, PhotonProperties } from "./reverse-select";
import { selectReverseFeature, selectVenue } from "./reverse-select";
import { createThrottle } from "./throttle";
import type {
  AddressParts,
  GeocodeCandidate,
  GeocodeProvider,
  GeocodeQuery,
  ReverseGeocodeQuery,
} from "./types";

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

/**
 * Public OSM-derived services block unidentified clients, and Node's default
 * (`undici`) is exactly that — a 403 from a WAF is indistinguishable here from
 * the service being down. Overridable so a self-hosted instance can be told who
 * is calling it.
 */
const DEFAULT_USER_AGENT =
  "custom-map-builder/1.0 (embeddable store locator; geocoding at import time only)";

/**
 * One retry, and only for failures that a second attempt can plausibly fix.
 *
 * The public instance returns intermittent 502s and 503s under load, and a
 * dropped pin whose address never arrives is the visible cost. This is
 * import-time and edit-time work on the server, never a visitor's request, so
 * §2 is untouched.
 */
const RETRY_BACKOFF_MS = 400;

/**
 * How far from the pin a reverse match may be, in kilometres.
 *
 * This is Photon's own default, stated explicitly rather than relied upon. It was
 * 2, on the belief that Photon is otherwise unbounded and that a wider number
 * narrows the search — it does neither. Measured against the live API: a point
 * 40km off the Lithuanian coast returns nothing at all with no `radius`, and only
 * yields a Kaliningrad oilfield 42.7km away when asked for `radius=50`. So the
 * old value was doubling the window it was meant to be closing.
 *
 * The real distance guard is `REVERSE_MAX_DISTANCE_M` in reverse-select.ts, which
 * measures against the pin rather than trusting the provider to bound itself.
 */
const REVERSE_RADIUS_KM = 1;

/**
 * How many features to weigh before picking one.
 *
 * `limit=1` was the bug: Photon ranks by distance, so the one feature it returned
 * was the nearest *object* — a building or a shop — and its street is the one it
 * is addressed on, not the one the pin is on. The alternatives the server needed
 * in order to notice were never asked for.
 *
 * 30 is enough to include the surrounding street ways alongside the buildings
 * (measured in Vilnius old town: 21 features, 7 of them streets) and costs
 * nothing extra — same request, same throttle slot, same round trip.
 */
const REVERSE_CANDIDATE_LIMIT = 30;

export function createPhotonProvider(options?: {
  endpoint?: string;
  minIntervalMs?: number;
  userAgent?: string;
}): GeocodeProvider {
  const endpoint = (
    options?.endpoint ??
    process.env.GEOCODER_URL ??
    DEFAULT_ENDPOINT
  ).replace(/\/$/, "");

  const userAgent =
    options?.userAgent ?? process.env.GEOCODER_USER_AGENT ?? DEFAULT_USER_AGENT;

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

      const features = await fetchFeatures(url, throttle, userAgent);

      return features
        .map((feature) => toCandidate(feature.properties ?? {}, feature))
        .filter((candidate): candidate is GeocodeCandidate => candidate !== null);
    },

    /**
     * Photon's `/reverse` sits on the same host as `/api` and answers in the same
     * GeoJSON shape, so the transport below this line is shared with `search`.
     *
     * What differs is the choosing. A text search returns candidate answers to
     * one question and the user picks; a coordinate has exactly one address, and
     * finding it means weighing everything nearby against the pin rather than
     * trusting the provider's distance ranking to have asked our question. That
     * judgement lives in reverse-select.ts.
     */
    async reverse({ lat, lng, road }: ReverseGeocodeQuery) {
      if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;

      const url = new URL(`${endpoint}/reverse`);
      url.searchParams.set("lat", String(lat));
      url.searchParams.set("lon", String(lng));
      url.searchParams.set("limit", String(REVERSE_CANDIDATE_LIMIT));
      url.searchParams.set("lang", "en");
      // Older Photon builds ignore an unknown parameter rather than erroring, so
      // this degrades to the previous behaviour rather than breaking on one.
      url.searchParams.set("radius", String(REVERSE_RADIUS_KM));

      const features = await fetchFeatures(url, throttle, userAgent);
      const match = selectReverseFeature(features, { lat, lng }, road);
      if (!match) return null;

      const parts = toAddressParts(match.properties);

      /*
       * The landmark the pin is standing in, asked separately and folded in here.
       *
       * Same features, same response, same throttle slot — the question is one of
       * selection, not of another lookup, so §2 is untouched.
       *
       * It fills `name` only when the address match left it empty, which is the
       * usual case: a pin on a museum resolves its *address* to the street
       * outside, and `asStreet` clears the name on the way past. When the match
       * is the venue itself the name is already right and this leaves it alone.
       *
       * Nothing else changes. `title` and `label` still lead with the street —
       * see formatTitle, which says why — and this is the field its comment
       * promises the name is kept in.
       */
      if (!parts.name) {
        const venue = selectVenue(features, { lat, lng });
        if (venue) parts.name = venue;
      }

      /*
       * The pin's own coordinates, not the matched feature's. The candidate
       * describes where the user put the pin; handing back the centroid of the
       * street segment it stands on would invite a caller to snap the pin there,
       * which is the one thing a person who just placed it did not ask for.
       */
      return {
        lat,
        lng,
        label: formatLabel(match.properties),
        title: formatTitle(match.properties),
        confidence: confidenceFor(match.properties.type, {
          hasHouseNumber: Boolean(match.properties.housenumber),
          distanceM: match.distanceM,
        }),
        parts,
      };
    },
  };
}

type Throttle = <T>(task: () => Promise<T>) => Promise<T>;

/**
 * Raw features rather than candidates, because the two callers need different
 * things from them: `search` maps every feature to an answer, `reverse` weighs
 * them all against a coordinate and returns one.
 */
async function fetchFeatures(
  url: URL,
  throttle: Throttle,
  userAgent: string,
): Promise<PhotonFeature[]> {
  try {
    return await throttle(() => requestFeatures(url, userAgent));
  } catch (error) {
    if (!isRetryable(error)) throw error;

    await sleep(RETRY_BACKOFF_MS);

    // Back through the throttle, so the retry takes its own slot rather than
    // jumping the queue ahead of whoever arrived while we were failing.
    return throttle(() => requestFeatures(url, userAgent));
  }
}

async function requestFeatures(
  url: URL,
  userAgent: string,
): Promise<PhotonFeature[]> {
  let response: Response;

  try {
    response = await fetch(url, {
      // Geocoding happens when the owner imports or places something, never when
      // a visitor loads the map, so this is never in a visitor's path (§2).
      cache: "no-store",
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
      headers: { accept: "application/json", "user-agent": userAgent },
    });
  } catch (error) {
    /*
     * DNS failures, refused connections and TLS errors reject as a bare
     * `TypeError: fetch failed`, which used to reach the route as an unrecognised
     * error and be reported as a 500 — a bug on our side, which it isn't. Wrapped
     * so every upstream failure arrives as one type, with the cause kept so an
     * aborted request is still recognisable as a timeout.
     */
    throw new GeocoderError("Could not reach the geocoder", undefined, error);
  }

  if (!response.ok) {
    throw new GeocoderError(
      `Photon returned ${response.status}`,
      response.status,
    );
  }

  const body = (await response.json()) as { features?: PhotonFeature[] };

  return body.features ?? [];
}

/**
 * Worth a second attempt: the service was unreachable, or answered with one of
 * its own gateway errors.
 *
 * A 4xx is not — a malformed query or a blocked client fails identically twice,
 * and retrying a 429 is the one thing guaranteed to make it worse.
 */
export function isRetryable(error: unknown): boolean {
  if (!(error instanceof GeocoderError)) return false;
  if (isTimeout(error)) return false;

  return error.status === undefined || error.status >= 500;
}

/** True for our own 8s abort, however the runtime chose to wrap it. */
export function isTimeout(error: unknown): boolean {
  if (!(error instanceof Error)) return false;
  if (error.name === "TimeoutError") return true;

  const cause = error.cause;
  return cause instanceof Error && cause.name === "TimeoutError";
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/** An unset or non-numeric value falls through to the default, not to NaN. */
function readInterval(): number | undefined {
  const raw = process.env.GEOCODER_MIN_INTERVAL_MS;
  if (!raw) return undefined;

  const parsed = Number(raw);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : undefined;
}

/**
 * Thrown for an upstream failure, so the route can tell it from a bad request.
 *
 * `status` is the geocoder's own, and is undefined when we never got an answer
 * at all — the two need telling apart both for what we log and for what we retry.
 */
export class GeocoderError extends Error {
  constructor(
    message: string,
    readonly status?: number,
    override readonly cause?: unknown,
  ) {
    super(message);
    this.name = "GeocoderError";
  }
}

/**
 * A search result, positioned at the feature's own coordinates.
 *
 * Reverse builds its candidate itself: it keeps the pin's coordinates rather
 * than the feature's, and it has a distance to fold into the confidence.
 */
function toCandidate(
  properties: PhotonProperties,
  feature: PhotonFeature,
): GeocodeCandidate | null {
  const coordinates = feature.geometry?.coordinates;
  if (!coordinates || coordinates.length < 2) return null;

  const [lng, lat] = coordinates;
  if (!Number.isFinite(lng) || !Number.isFinite(lat)) return null;

  return {
    lat,
    lng,
    label: formatLabel(properties),
    title: formatTitle(properties),
    confidence: confidenceFor(properties.type, {
      hasHouseNumber: Boolean(properties.housenumber),
    }),
    // Search results carry their parts too. A location added straight from the
    // address bar never reaches the reverse geocoder — this is its only chance to
    // learn its own postcode, and without it the row went on showing the
    // placeholder name.
    parts: toAddressParts(properties),
  };
}

/**
 * Photon's properties → the parts we keep, renamed to this codebase's spelling.
 *
 * A copy rather than the raw object: Photon's own keys are lowercase-run-together
 * (`countrycode`, `osm_id`) and carry things that are meaningless once saved, like
 * the `extent` of the feature that happened to match. Storing its wire shape
 * verbatim would make the provider swap CLAUDE.md §7 plans for a migration.
 *
 * Empty fields are dropped rather than stored as "", so a row with no postcode
 * says so by not having one.
 */
export function toAddressParts(properties: PhotonProperties): AddressParts {
  const parts: AddressParts = {};

  const copy: Array<[keyof AddressParts, string | number | undefined]> = [
    ["housenumber", properties.housenumber],
    ["street", properties.street],
    ["postcode", properties.postcode],
    ["city", properties.city],
    ["district", properties.district],
    ["state", properties.state],
    ["country", properties.country],
    ["countryCode", properties.countrycode],
    ["name", properties.name],
    ["osmType", properties.osm_type],
    ["osmId", properties.osm_id],
  ];

  for (const [key, value] of copy) {
    if (value === undefined || value === "") continue;
    parts[key] = value;
  }

  return parts;
}

/** "Gedimino pr." + "1" → "Gedimino pr. 1". Empty when neither part is present. */
function streetLine(properties: PhotonProperties): string {
  return [properties.street, properties.housenumber].filter(Boolean).join(" ");
}

/**
 * Photon returns address parts, not a formatted line. Joined here so the review
 * step and the place's `address` field show the same string.
 *
 * Exported for tests: the joining rules are the whole behaviour, and they are not
 * reachable through `search` without a network round trip.
 */
export function formatLabel(properties: PhotonProperties): string {
  const street = streetLine(properties);

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

/**
 * The short form: what a location is called when it has no name of its own.
 *
 * Street, house number and town — no postcode, no country. This ends up as a row
 * title in the Locations panel and as the heading on the place card, where the
 * full label wraps to three lines and buries the part that identifies the place.
 *
 * A venue with a name of its own leads with that instead ("Corner Shop, Vilnius"),
 * since it is more use than the street it happens to sit on. Falls back to the
 * full label so this never returns the empty string over a real result.
 */
export function formatTitle(properties: PhotonProperties): string {
  const street = streetLine(properties);
  const town = properties.city ?? properties.district ?? properties.state ?? "";

  /*
   * The street leads, always — even when the match is a museum or a hotel with a
   * name of its own. It used to be the other way round, and a pin dropped on the
   * Vytautas Kasiulis Museum of Art read "Vytautas Kasiulis Museum of Art,
   * Vilnius": memorable, and not an address. This line has to say *where* the
   * place is, because it is the only line that does.
   *
   * The name is not thrown away. `toAddressParts` keeps it, and the row prints it
   * on the second line right after the postcode, which is where a landmark is
   * useful without displacing the street.
   *
   * A venue with no street at all — a park, a bridge, a mountain — still leads
   * with its name, because then the name *is* the most locating thing there is.
   */
  const leading = street || properties.name || "";

  const title = [leading, town].filter(Boolean).join(", ");

  return title || formatLabel(properties);
}
