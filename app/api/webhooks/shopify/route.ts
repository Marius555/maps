import { NextResponse, type NextRequest } from "next/server";

import { forgetUser } from "@/lib/auth/identity-cache";
import { toShopifyState } from "@/lib/billing/shopify-pricing";
import { env } from "@/lib/env";
import { findShop, updateShop } from "@/lib/repositories/shopify-shops.repository";
import { upsertSubscription } from "@/lib/repositories/subscriptions.repository";
import { forgetAdminSession } from "@/lib/shopify/admin-api";
import { parseShopDomain } from "@/lib/shopify/shop-domain";
import { verifyWebhookHmac } from "@/lib/shopify/webhook-hmac";

/**
 * Shopify's webhooks: the uninstall, and the three privacy topics every App
 * Store app must answer (docs/notes/shopify.md, "Lifecycle"). Subscribed in
 * `distribution/shopify/shopify.app.toml`.
 *
 * **Raw body, then HMAC, then parse** — the same rule as the billing webhook,
 * for the same reason: the signature is over the bytes. An unsigned or
 * mis-signed request is a 401, which is what Shopify's review checks for, and
 * so is every request while the app is not configured.
 *
 * **Answer fast.** Shopify wants a 2xx within five seconds and retries
 * otherwise, so nothing slow happens here: `shop/redact` only stamps the shop,
 * and the hourly sweep does the deleting in bounded steps.
 *
 * - `app/uninstalled` — mark the shop, drop its cached token, and put it on
 *   the free plan (Shopify cancels the subscription itself). Its maps stay
 *   until `shop/redact`, so a merchant who reinstalls finds them.
 * - `shop/redact` — sent 48 hours after an uninstall. Erase the workspace.
 * - `customers/data_request`, `customers/redact` — we hold nothing about a
 *   shop's customers: storefront visitors in Analytics are anonymous and never
 *   tied to a Shopify customer. Acknowledged, nothing to do.
 */
export const dynamic = "force-dynamic";

const MAX_BODY_BYTES = 64 * 1024;

export async function POST(request: NextRequest): Promise<Response> {
  if (Number(request.headers.get("content-length") ?? 0) > MAX_BODY_BYTES) {
    return new Response(null, { status: 413 });
  }

  const raw = await request.text();
  if (!verifyWebhookHmac(raw, request.headers.get("x-shopify-hmac-sha256"), env.shopifyClientSecret)) {
    return new Response(null, { status: 401 });
  }

  const topic = request.headers.get("x-shopify-topic") ?? "";
  const domain = parseShopDomain(request.headers.get("x-shopify-shop-domain"));
  if (!domain) return NextResponse.json({ ok: true, note: "no shop domain" });

  try {
    if (topic === "app/uninstalled") await uninstalled(domain);
    else if (topic === "shop/redact") await redactRequested(domain);
    // customers/data_request, customers/redact and anything else: nothing held.
  } catch (error) {
    // Ours to fix, and worth Shopify's retry.
    console.error(`[shopify] webhook ${topic} for ${domain} failed:`, error);
    return new Response(null, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}

async function uninstalled(domain: string): Promise<void> {
  const shop = await findShop(domain);
  if (!shop) return;

  await updateShop(shop.id, { uninstalledAt: new Date().toISOString() });
  await upsertSubscription(
    toShopifyState({ workspaceId: shop.workspaceId, shop: shop.shop, subscription: null, frozen: false }),
  );

  forgetAdminSession(domain);
  forgetUser(shop.workspaceId);
}

async function redactRequested(domain: string): Promise<void> {
  const shop = await findShop(domain);
  if (!shop || shop.redactAfter) return;

  await updateShop(shop.id, { redactAfter: new Date().toISOString() });
  forgetUser(shop.workspaceId);
}
