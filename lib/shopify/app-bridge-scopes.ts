/**
 * Asking the merchant for an optional access scope from inside the Shopify
 * admin, through App Bridge's Scopes API (docs/notes/shopify.md, "Scopes").
 *
 * `shopify.scopes.request` opens Shopify's own grant dialog; nothing is asked
 * at install, because every scope this app uses is optional (`./scopes.ts`).
 * Browser-only, and typed here rather than through `@shopify/app-bridge-types`,
 * a package for the two calls used.
 */

type ScopesApi = {
  query(): Promise<{ granted: string[] }>;
  request(scopes: string[]): Promise<{ result: "granted-all" | "declined-all" }>;
};

function scopesApi(): ScopesApi | null {
  if (typeof window === "undefined") return null;

  return (window as { shopify?: { scopes?: ScopesApi } }).shopify?.scopes ?? null;
}

/**
 * Make sure `scope` is granted, asking once if it is not.
 *
 * `"unavailable"` when App Bridge is not on the page (it loads only inside the
 * admin) — the caller goes ahead and the server, which checks the token's real
 * grants, has the last word.
 */
export async function ensureScope(scope: string): Promise<"granted" | "declined" | "unavailable"> {
  const api = scopesApi();
  if (!api) return "unavailable";

  const { granted } = await api.query();
  if (granted.includes(scope)) return "granted";

  const { result } = await api.request([scope]);
  return result === "granted-all" ? "granted" : "declined";
}
