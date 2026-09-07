import "server-only";

import { createThrottle } from "@/lib/geocoding/throttle";

/**
 * The transport every Geoapify call goes through.
 *
 * Not a provider, deliberately: nothing in this file knows what a route or an
 * address candidate is. The adapters that do — lib/routing/geoapify.ts and
 * lib/geocoding/geoapify.ts — stay inside their own folders, so CLAUDE.md §7's
 * rule that a provider is never imported outside its boundary is intact. What
 * lives here is the key, the pacing and the retry.
 *
 * **One throttle for both adapters, and that is the reason this file exists at
 * all.** One Geoapify account has one rate limit and one credit budget, so a
 * routing throttle and a geocoding throttle pacing themselves independently
 * would together run at twice the rate either of them promised. It is the same
 * argument `getGeocoder()` and `getRouter()` already make for one provider
 * instance per process, one level up.
 *
 * None of this is in a visitor's path. Geocoding runs when an owner imports or
 * drops a pin; routing runs when they draw or recalculate. The results are baked
 * into the row and then into the published snapshot, which is what makes a
 * metered upstream affordable here at all (CLAUDE.md §2).
 */

const ENDPOINT = "https://api.geoapify.com";

/**
 * Geoapify is a paid service rather than a demo server, so the pace that Photon
 * and the OSRM demo instance ask for (one request a second) is far too slow —
 * arming the route tool sweeps up to 200 pins, which would take 200 seconds.
 * Low enough to keep a sweep brisk, high enough that a burst does not trip the
 * plan's own per-second limit. `GEOAPIFY_MIN_INTERVAL_MS` moves it.
 *
 * **220ms, not the 120ms this was.** 120ms is 8.3 requests a second and
 * Geoapify's free plan allows five, so the pacing that existed to stay under the
 * plan's limit was over it — invisible at the two or three requests a pin drop
 * makes, and a wall of 429s the moment an import walked a real file past it.
 * 220ms is ~4.5/s, inside the free plan with room to spare, and still eight
 * times the demo servers' pace. A paid plan allows far more: set
 * `GEOAPIFY_MIN_INTERVAL_MS` rather than editing this, because the ceiling is a
 * property of the account and not of the code.
 */
const DEFAULT_MIN_INTERVAL_MS = 220;

const REQUEST_TIMEOUT_MS = 8000;

/** One retry, for failures a second attempt can plausibly fix. */
const RETRY_BACKOFF_MS = 400;

/**
 * Sent for the same reason the Photon and OSRM adapters send one: an
 * unidentified client is what a WAF blocks, and a 403 from one is otherwise
 * indistinguishable from the service being down.
 */
const USER_AGENT =
  "custom-map-builder/1.0 (embeddable store locator; geocoding and routing at edit time only)";

/**
 * Thrown for any Geoapify failure.
 *
 * It never reaches a route handler as itself. `lib/api/geocoder-errors.ts` and
 * `lib/api/router-errors.ts` each recognise their own domain's error type and
 * re-throw anything else as a bug, so each adapter translates this into
 * `GeocoderError` or `RoutingError` on the way out — carrying `status` and
 * `cause`, since `isTimeout` reads the cause and the two mappers read the status.
 */
export class GeoapifyError extends Error {
  constructor(
    message: string,
    readonly status?: number,
    override readonly cause?: unknown,
  ) {
    super(message);
    this.name = "GeoapifyError";
  }
}

type Throttle = <T>(task: () => Promise<T>) => Promise<T>;

let throttle: Throttle | null = null;

/**
 * Lazy, so importing this module never reads the environment — the adapters are
 * constructed at first use and vitest imports their pure readers freely.
 */
function getThrottle(): Throttle {
  throttle ??= createThrottle(geoapifyPaceMs());
  return throttle;
}

/**
 * The spacing this process is actually holding, for a caller that has to say how
 * long something will take. Read from the same place the throttle reads it, so
 * the two cannot drift.
 */
export function geoapifyPaceMs(): number {
  return readInterval() ?? DEFAULT_MIN_INTERVAL_MS;
}

/**
 * One paced, retried GET against Geoapify, with the key appended here and
 * nowhere else.
 *
 * The key is appended last and the URL is never logged or put into an error
 * message — a `RoutingError` carrying the request URL would print the key into
 * the server log on every upstream failure.
 */
export async function geoapifyGet<T>(
  path: string,
  params: URLSearchParams,
): Promise<T> {
  const url = new URL(path, ENDPOINT);
  for (const [key, value] of params) url.searchParams.set(key, value);
  url.searchParams.set("apiKey", apiKey());

  const paced = getThrottle();

  try {
    return await paced(() => request<T>(url));
  } catch (error) {
    if (!isRetryable(error)) throw error;

    await sleep(RETRY_BACKOFF_MS);

    // Back through the throttle, so the retry takes its own slot rather than
    // jumping ahead of whoever arrived while we were failing.
    return paced(() => request<T>(url));
  }
}

async function request<T>(url: URL): Promise<T> {
  let response: Response;

  try {
    response = await fetch(url, {
      // Edit-time only, never a visitor's request (§2).
      cache: "no-store",
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
      headers: { accept: "application/json", "user-agent": USER_AGENT },
    });
  } catch (error) {
    // DNS failures, refused connections and TLS errors reject as a bare
    // `TypeError: fetch failed`. Wrapped so every upstream failure arrives as one
    // type, with the cause kept so a timeout stays recognisable.
    throw new GeoapifyError("Could not reach Geoapify", undefined, error);
  }

  if (!response.ok) {
    throw new GeoapifyError(`Geoapify returned ${response.status}`, response.status);
  }

  return (await response.json()) as T;
}

/**
 * Worth a second attempt: unreachable, or one of Geoapify's own gateway errors.
 * A 4xx fails identically twice, and retrying a 429 is the one thing guaranteed
 * to make it worse.
 */
export function isRetryable(error: unknown): boolean {
  if (!(error instanceof GeoapifyError)) return false;
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

/**
 * Server-only and unprefixed, in the class of `APPWRITE_API_KEY` — it must never
 * reach a client component or the embed bundle (CLAUDE.md §9).
 *
 * Missing is a configuration mistake rather than an upstream failure, but it is
 * thrown as one so the route handler answers "couldn't reach the service" rather
 * than falling through to a 500 that reads as a bug in the map editor.
 */
function apiKey(): string {
  const key = process.env.GEOAPIFY_API_KEY;

  if (!key) {
    throw new GeoapifyError("GEOAPIFY_API_KEY is not set");
  }

  return key;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/** An unset or non-numeric value falls through to the default, not to NaN. */
function readInterval(): number | undefined {
  const raw = process.env.GEOAPIFY_MIN_INTERVAL_MS;
  if (!raw) return undefined;

  const parsed = Number(raw);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : undefined;
}
