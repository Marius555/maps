import type { NextResponse } from "next/server";

import { frameAncestorsFor } from "./shop-domain";

/**
 * Let one shop's admin — and nothing else — frame this response.
 *
 * Every response carries `X-Frame-Options: SAMEORIGIN` and
 * `frame-ancestors 'self'` from `next.config.ts`; a page shown inside the
 * Shopify admin needs exactly the shop and the admin instead, which Shopify
 * checks. Only ever called with a shop taken from a verified ID token, or for
 * the bounce page and error pages from a shop that passed `parseShopDomain` —
 * never with a value straight off the query string.
 */
export function allowFramingBy(response: NextResponse | Response, shop: string): void {
  response.headers.set("Content-Security-Policy", `frame-ancestors ${frameAncestorsFor(shop)};`);
  response.headers.delete("X-Frame-Options");
}
