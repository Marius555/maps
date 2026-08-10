import { darkenStyle } from "./darken-style";

/**
 * Fetches a style and, when asked, inverts it for dark mode.
 *
 * MapLibre accepts either a URL or a parsed style object, so the light path
 * hands back the URL untouched and costs nothing — MapLibre fetches it exactly
 * as it did before. Only the dark path pulls the JSON down itself, and even then
 * it is the same single request MapLibre would have made.
 *
 * Results are cached per URL for the life of the page. The editor mounts a map
 * on several routes and the preview mounts another, and re-parsing a 100KB style
 * for each of them is work with no output.
 *
 * Shared by the dashboard and the embed, and dependency-free for that reason —
 * see ./darken-style.ts.
 */

export type LoadedStyle = string | Record<string, unknown>;

const cache = new Map<string, Promise<Record<string, unknown>>>();

export function loadMapStyle(url: string, darken: boolean): LoadedStyle | Promise<LoadedStyle> {
  if (!darken) return url;

  const cached = cache.get(url);
  if (cached) return cached;

  const pending = fetch(url, { credentials: "omit" })
    .then((response) => {
      if (!response.ok) {
        throw new Error(`Style request failed with ${response.status}`);
      }

      return response.json() as Promise<Record<string, unknown>>;
    })
    .then(darkenStyle)
    .catch((error: unknown) => {
      // A failed fetch must not poison the cache: the next map to mount should
      // get a fresh attempt rather than inheriting this one's rejection.
      cache.delete(url);
      throw error;
    });

  cache.set(url, pending);

  return pending;
}
