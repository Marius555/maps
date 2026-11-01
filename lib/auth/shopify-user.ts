import "server-only";

import { headers } from "next/headers";

import { env } from "@/lib/env";
import { findShop } from "@/lib/repositories/shopify-shops.repository";
import { bearerToken, verifyIdToken, type VerifiedIdToken } from "@/lib/shopify/id-token";
import { storeHandle } from "@/lib/shopify/shop-domain";
import { readCachedUser, rememberUser } from "./identity-cache";
import type { AuthUser } from "./types";

/**
 * The second way a request can say who it is: a Shopify ID token, for a page
 * running inside the Shopify admin (docs/notes/shopify.md).
 *
 * **Why a second credential at all.** The admin frames our pages from another
 * site, so our `sameSite: "strict"` session cookie is never sent there — and
 * Shopify's App Store requires embedded apps to work with third-party cookies
 * blocked regardless. App Bridge instead attaches a one-minute JWT to every
 * same-origin `fetch` as `Authorization: Bearer …`, and the admin puts one in
 * the query string of every document it loads, which `proxy.ts` copies into the
 * same header. So by the time anything here runs, the token is in one place.
 *
 * **It never becomes a cookie, and never creates anything.** A shop with no row
 * is not signed in: the row is made by the App Home (`app/shopify/route.ts`),
 * which is where installing happens. Everything else answers 401, and App
 * Bridge retries with a fresh token or the admin reloads the app.
 *
 * Cached for a minute per shop in the same cache cookie sessions use, keyed so
 * the two can never collide. The token itself is verified on every request
 * before the cache is read — the cache saves the database read, not the check.
 */

const CACHE_PREFIX = "shopify:";

export async function shopifyUserFromRequest(): Promise<AuthUser | null> {
  const verified = await currentIdToken();
  if (!verified) return null;

  const key = `${CACHE_PREFIX}${verified.shop}`;
  const cached = readCachedUser(key);
  if (cached) return cached;

  const shop = await findShop(verified.shop);
  if (!shop || shop.uninstalledAt) return null;

  const user: AuthUser = {
    id: shop.workspaceId,
    email: shop.email,
    name: shop.name || shop.shop,
    // Shopify verified the merchant; the email gate is about our own signups.
    emailVerified: true,
    shopify: {
      shop: shop.shop,
      storeHandle: storeHandle(shop.shop),
      pricingUrl: `https://admin.shopify.com/store/${storeHandle(shop.shop)}/charges/${env.shopifyAppHandle}/pricing_plans`,
    },
  };
  rememberUser(key, user);

  return user;
}

/**
 * The verified ID token on this request, with the raw token for a token
 * exchange — or null when there is none, or it does not verify.
 */
export async function currentIdToken(): Promise<(VerifiedIdToken & { token: string }) | null> {
  const token = bearerToken((await headers()).get("authorization"));
  if (!token) return null;

  const verified = verifyIdToken(token, {
    clientId: env.shopifyClientId,
    clientSecret: env.shopifyClientSecret,
  });

  return verified ? { ...verified, token } : null;
}
