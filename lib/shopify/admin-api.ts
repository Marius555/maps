import "server-only";

import { env } from "@/lib/env";
import { parseShopDomain } from "./shop-domain";

/**
 * Talking to one shop's Admin API, as our app.
 *
 * **No access token is stored.** Every Admin API call this app makes happens
 * while the merchant is inside the app — installing, connecting a map to the
 * storefront, creating a page — so there is always a fresh ID token to exchange
 * (Shopify's token-exchange grant). The offline token that comes back is kept
 * in process memory until it nears expiry and is never written anywhere: a
 * leaked database is then not a set of keys to every merchant's store. The day
 * something has to call a shop with nobody in the app (a scheduled import of
 * the shop's locations, say), that is a decision to store one, encrypted, and
 * it belongs in docs/notes/shopify.md first.
 *
 * Expiring offline tokens, because Shopify's own libraries now request them by
 * default; nothing here needs the refresh token, since a new exchange is always
 * one ID token away.
 */

export const SHOPIFY_API_VERSION = "2026-10";

const REQUEST_TIMEOUT_MS = 10_000;
/** A cached token this close to expiry is treated as gone. */
const EXPIRY_MARGIN_MS = 60_000;

type CachedToken = { token: string; scope: string; expiresAt: number | null };

/*
 * On globalThis rather than in module scope: Next keeps separate module
 * instances for route handlers and pages in one process, and a cache in module
 * scope would exist twice (memory: next-module-state-split-between-routes-and-pages).
 */
const GLOBAL_KEY = Symbol.for("pinglide.shopify.tokens");
type TokenStore = Map<string, CachedToken>;
const tokens: TokenStore = ((globalThis as Record<symbol, unknown>)[GLOBAL_KEY] ??=
  new Map()) as TokenStore;

/** Shopify answered with something other than success. Never carries a secret. */
export class ShopifyApiError extends Error {
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message);
    this.name = "ShopifyApiError";
  }
}

export type AdminSession = { shop: string; accessToken: string; scope: string };

/**
 * An Admin API session for `shop`, exchanging `idToken` for an offline access
 * token unless a live one is cached. The caller has already verified the ID
 * token and taken `shop` from it.
 */
export async function adminSession(shop: string, idToken: string): Promise<AdminSession> {
  const domain = parseShopDomain(shop);
  if (!domain) throw new ShopifyApiError("Not a shop domain.", 400);

  const cached = tokens.get(domain);
  if (cached && (cached.expiresAt === null || cached.expiresAt - EXPIRY_MARGIN_MS > Date.now())) {
    return { shop: domain, accessToken: cached.token, scope: cached.scope };
  }

  const response = await fetch(`https://${domain}/admin/oauth/access_token`, {
    method: "POST",
    headers: { "content-type": "application/json", accept: "application/json" },
    body: JSON.stringify({
      client_id: env.shopifyClientId,
      client_secret: env.shopifyClientSecret,
      grant_type: "urn:ietf:params:oauth:grant-type:token-exchange",
      subject_token: idToken,
      subject_token_type: "urn:ietf:params:oauth:token-type:id_token",
      requested_token_type: "urn:shopify:params:oauth:token-type:offline-access-token",
      expiring: "1",
    }),
    signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
  });

  if (!response.ok) {
    throw new ShopifyApiError(
      `Shopify refused the token exchange for ${domain} (${response.status}).`,
      response.status,
    );
  }

  const body = (await response.json()) as {
    access_token?: string;
    scope?: string;
    expires_in?: number;
  };
  if (!body.access_token) {
    throw new ShopifyApiError(`Shopify's token exchange for ${domain} returned no token.`, 502);
  }

  const entry: CachedToken = {
    token: body.access_token,
    scope: body.scope ?? "",
    expiresAt: typeof body.expires_in === "number" ? Date.now() + body.expires_in * 1000 : null,
  };
  tokens.set(domain, entry);

  return { shop: domain, accessToken: entry.token, scope: entry.scope };
}

/** Drop a shop's cached token — on uninstall, when Shopify has revoked it anyway. */
export function forgetAdminSession(shop: string): void {
  tokens.delete(shop);
}

/**
 * One Admin GraphQL request. Throws on a transport failure or a top-level
 * `errors` array; `userErrors` inside a mutation's payload are the caller's,
 * because only the caller knows which of them matter.
 */
export async function adminGraphql<T>(
  session: AdminSession,
  query: string,
  variables?: Record<string, unknown>,
): Promise<T> {
  const response = await fetch(
    `https://${session.shop}/admin/api/${SHOPIFY_API_VERSION}/graphql.json`,
    {
      method: "POST",
      headers: {
        "content-type": "application/json",
        accept: "application/json",
        "x-shopify-access-token": session.accessToken,
      },
      body: JSON.stringify({ query, variables }),
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    },
  );

  if (response.status === 401) forgetAdminSession(session.shop);
  if (!response.ok) {
    throw new ShopifyApiError(
      `Shopify's Admin API answered ${response.status} for ${session.shop}.`,
      response.status,
    );
  }

  const body = (await response.json()) as { data?: T; errors?: { message?: string }[] };
  if (body.errors?.length || !body.data) {
    const first = body.errors?.[0]?.message ?? "no data";
    throw new ShopifyApiError(`Shopify's Admin API refused a query for ${session.shop}: ${first}`, 502);
  }

  return body.data;
}

export type ShopInfo = {
  /** `gid://shopify/Shop/<n>` */
  id: string;
  name: string;
  email: string;
  /** The storefront's public host, which may be the shop domain itself. */
  primaryDomain: string;
  appInstallationId: string;
};

export async function readShopInfo(session: AdminSession): Promise<ShopInfo> {
  const data = await adminGraphql<{
    shop: { id: string; name: string; email: string; primaryDomain: { host: string } | null };
    currentAppInstallation: { id: string };
  }>(
    session,
    `query PinglideShopInfo {
      shop { id name email primaryDomain { host } }
      currentAppInstallation { id }
    }`,
  );

  return {
    id: data.shop.id,
    name: data.shop.name,
    email: data.shop.email,
    primaryDomain: data.shop.primaryDomain?.host || session.shop,
    appInstallationId: data.currentAppInstallation.id,
  };
}
