import { applyAppearance, isPlainAppearance, type MapAppearance } from "./map-appearance";

/**
 * Fetches a style and, when asked, restyles it before the map is built.
 *
 * MapLibre accepts either a URL or a parsed style object, so a map with nothing
 * to change hands back the URL untouched and costs nothing — MapLibre fetches it
 * exactly as it did before. Only a themed map pulls the JSON down itself, and
 * even then it is the same single request MapLibre would have made.
 *
 * The cache holds the **raw** style, not the transformed one. It used to hold the
 * result, which was correct while there was exactly one transform: dark or not.
 * Now one URL feeds a dozen looks — Liberty is the source of every theme — so
 * caching the output would serve the first map's theme to the second map. The
 * transforms are pure and build copies, so re-running them over a shared raw
 * object is safe, and it is the cheap half anyway: the fetch is what hurts.
 *
 * Shared by the dashboard and the embed, and dependency-free for that reason —
 * see ./style-tint.ts.
 */

export type LoadedStyle = string | Record<string, unknown>;

const cache = new Map<string, Promise<Record<string, unknown>>>();

export function loadMapStyle(
  url: string,
  appearance: MapAppearance | null,
): LoadedStyle | Promise<LoadedStyle> {
  if (isPlainAppearance(appearance)) return url;

  return fetchStyle(url).then((style) => applyAppearance(style, appearance!));
}

function fetchStyle(url: string): Promise<Record<string, unknown>> {
  const cached = cache.get(url);
  if (cached) return cached;

  const pending = fetch(url, { credentials: "omit" })
    .then((response) => {
      if (!response.ok) {
        throw new Error(`Style request failed with ${response.status}`);
      }

      return response.json() as Promise<Record<string, unknown>>;
    })
    .catch((error: unknown) => {
      // A failed fetch must not poison the cache: the next map to mount should
      // get a fresh attempt rather than inheriting this one's rejection.
      cache.delete(url);
      throw error;
    });

  cache.set(url, pending);

  return pending;
}
