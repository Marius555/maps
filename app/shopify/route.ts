import { NextResponse, type NextRequest } from "next/server";

import { env } from "@/lib/env";
import { bounceRedirect, intoAdminRedirect } from "@/lib/shopify/bounce";
import { allowFramingBy } from "@/lib/shopify/framing";
import { bearerToken, verifyIdToken } from "@/lib/shopify/id-token";
import { provisionShop } from "@/lib/shopify/install";
import { installErrorPage } from "@/lib/shopify/pages";
import { reconcileShopPlan } from "@/lib/shopify/plan-sync";
import { parseShopDomain } from "@/lib/shopify/shop-domain";

/**
 * The Shopify app's home: where the admin lands when a merchant opens Pinglide
 * (`/?shop=…` is our `application_url`, and `proxy.ts` sends it here), and so
 * where installing happens (docs/notes/shopify.md).
 *
 * 1. Verify the ID token the admin put in the URL.
 * 2. Make sure the shop has a workspace — the first time this is the install
 *    (`provisionShop`).
 * 3. Re-read the plan from Shopify when it is stale, or when Shopify has just
 *    sent the merchant back from choosing one (`plan_handle`).
 * 4. Go on to the maps list, with the admin's query string kept, so the next
 *    document still carries the token `proxy.ts` reads.
 *
 * A route handler, not a page: it renders nothing, and a page would sit under
 * the dashboard layout, which needs the workspace this creates. Outside
 * `proxy.ts`'s matcher, because it is a cross-site landing (docs/notes/auth.md).
 */
export const dynamic = "force-dynamic";

export async function GET(request: NextRequest): Promise<Response> {
  const keys = { clientId: env.shopifyClientId, clientSecret: env.shopifyClientSecret };
  if (!keys.clientId || !keys.clientSecret) return new Response(null, { status: 404 });

  const params = request.nextUrl.searchParams;
  const token = params.get("id_token") ?? bearerToken(request.headers.get("authorization"));
  const verified = token ? verifyIdToken(token, keys) : null;

  if (!token || !verified) {
    const shop = parseShopDomain(params.get("shop"));
    if (!shop) return new Response(null, { status: 404 });

    return params.get("embedded") === "1"
      ? bounceRedirect(request, shop)
      : intoAdminRedirect(shop, keys.clientId);
  }

  let shop;
  try {
    shop = await provisionShop(verified.shop, token);
  } catch (error) {
    console.error(`[shopify] opening the app failed for ${verified.shop}:`, error);
    return installErrorPage(verified.shop);
  }

  // A Partner API wobble must not keep a merchant out of their maps: the stored
  // plan stands, and the hourly sweep re-reads it.
  try {
    await reconcileShopPlan(shop, { justChose: params.has("plan_handle") });
  } catch (error) {
    console.error(`[shopify] re-reading the plan for ${verified.shop} failed:`, error);
  }

  // The configured origin, never the request's: behind the dev tunnel the
  // request's is `https://localhost:<port>` (`appOrigin`, lib/shopify/bounce.ts).
  const maps = new URL("/maps", env.appUrl);
  maps.search = params.toString();

  const response = NextResponse.redirect(maps);
  allowFramingBy(response, verified.shop);
  return response;
}
