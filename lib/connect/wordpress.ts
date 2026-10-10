import {
  isDomainAllowed,
  MAX_ALLOWED_DOMAINS,
  normalizeDomain,
} from "@/lib/validation/domain.schema";

/**
 * The two decisions the WordPress connection makes that are worth a test of
 * their own: where the browser goes back to, and what happens to the map's
 * domain allowlist. Pure, so both run in vitest without a server.
 * `docs/notes/distribution.md`.
 */

/** The `action` the plugin registers `admin_post_pinglide_connect` under. */
export const WORDPRESS_CONNECT_ACTION = "pinglide_connect";

export type ConnectedMap = {
  mapId: string;
  name: string;
  /** The live snapshot — stable across republishes, so the plugin stores it once. */
  snapshotUrl: string;
  /** `map.js`, as `embedScriptUrl` resolves it for this deployment. */
  scriptUrl: string;
};

/**
 * The plugin's `admin-post.php` with the answer on it.
 *
 * Built on `URL` rather than by concatenation: the return address arrives with
 * a query string of its own on some hosts (`?lang=…` from a translation plugin)
 * and must keep it. `action` is set last so nothing in the original can override
 * which WordPress handler receives this.
 *
 * Nothing secret goes on this URL, and that is the design rather than luck: the
 * snapshot is already public, and what stops a forged link setting a block to a
 * stranger's map is the plugin's nonce (`state`), checked on arrival.
 */
export function buildReturnUrl(
  returnUrl: string,
  { state, slot }: { state: string; slot: string },
  map: ConnectedMap,
): string {
  const url = new URL(returnUrl);

  url.searchParams.set("state", state);
  url.searchParams.set("slot", slot);
  url.searchParams.set("map", map.mapId);
  url.searchParams.set("name", map.name);
  url.searchParams.set("snapshot", map.snapshotUrl);
  url.searchParams.set("script", map.scriptUrl);
  url.searchParams.set("action", WORDPRESS_CONNECT_ACTION);

  return url.toString();
}

/** The address bar's host, as the allowlist stores hosts. */
export function siteHost(site: string): string {
  return normalizeDomain(site);
}

export type AllowSiteResult =
  /** Nothing to write: everywhere is allowed, or this site already is. */
  | { kind: "unchanged" }
  | { kind: "added"; domains: string[] }
  /** The list is full. The map works everywhere it did, and not here. */
  | { kind: "full" };

/**
 * Let `host` show a map whose allowlist may already be restricted.
 *
 * **An empty list is left empty**, and this is the case that matters most: empty
 * means "any site" (`isDomainAllowed`), so adding the WordPress host to it would
 * switch the map *off* on every other page it is already pasted into.
 */
export function allowSite(domains: readonly string[], host: string): AllowSiteResult {
  if (isDomainAllowed(host, [...domains])) return { kind: "unchanged" };
  if (domains.length >= MAX_ALLOWED_DOMAINS) return { kind: "full" };

  return { kind: "added", domains: [...domains, host] };
}
