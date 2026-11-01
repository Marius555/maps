import type { NextRequest } from "next/server";

import { env } from "@/lib/env";
import { bouncePage } from "@/lib/shopify/pages";
import { parseShopDomain } from "@/lib/shopify/shop-domain";

/**
 * App Bridge's bounce page: a document that reached us from the Shopify admin
 * with no ID token, or an expired one, is redirected here (`bounceRedirect`),
 * App Bridge reads `shopify-reload` and loads that URL again with a fresh
 * token. Nothing else is on the page — it is never seen for longer than App
 * Bridge takes to start.
 *
 * Outside `proxy.ts`'s matcher, because it is a cross-site landing
 * (docs/notes/auth.md).
 */
export const dynamic = "force-dynamic";

export function GET(request: NextRequest): Response {
  const shop = parseShopDomain(request.nextUrl.searchParams.get("shop"));

  if (!shop || !env.shopifyClientId || !env.shopifyClientSecret) {
    return new Response(null, { status: 404 });
  }

  return bouncePage(shop);
}
