import "server-only";

import { env } from "@/lib/env";
import { allowFramingBy } from "./framing";

/**
 * The two bare HTML pages the Shopify side serves outside React: App Bridge's
 * bounce page and the install error. Route handlers rather than React pages
 * because neither needs a layout, and the bounce page must be nothing but App
 * Bridge — it exists only for App Bridge to read `shopify-reload` and reload.
 */

export const APP_BRIDGE_SRC = "https://cdn.shopify.com/shopifycloud/app-bridge.js";

/**
 * App Bridge on its own. When the URL carries `shopify-reload`, App Bridge
 * fetches a fresh ID token and loads that URL with it — Shopify's documented
 * recovery for a document that arrived with no token or an expired one.
 */
export function bouncePage(shop: string): Response {
  return html(
    shop,
    `<script data-api-key="${attr(env.shopifyClientId)}" src="${APP_BRIDGE_SRC}"></script>`,
    200,
  );
}

/**
 * What a merchant sees when opening the app failed on our side. §8: what
 * happened and what to do about it, not "something went wrong".
 */
export function installErrorPage(shop: string): Response {
  return html(
    shop,
    `<script data-api-key="${attr(env.shopifyClientId)}" src="${APP_BRIDGE_SRC}"></script>
<main style="font:15px/1.5 system-ui,sans-serif;max-width:32rem;margin:15vh auto;padding:0 16px">
  <h1 style="font-size:18px;margin:0 0 8px">Pinglide couldn't open</h1>
  <p style="margin:0">We couldn't reach your store or our database just now, so your maps didn't load. Reload this page to try again. If it keeps happening, email support and mention ${escape(shop)}.</p>
</main>`,
    503,
  );
}

function html(shop: string, body: string, status: number): Response {
  const response = new Response(
    `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="robots" content="noindex"><title>Pinglide</title></head><body>${body}</body></html>`,
    {
      status,
      headers: {
        "content-type": "text/html; charset=utf-8",
        "cache-control": "private, no-store",
      },
    },
  );
  allowFramingBy(response, shop);
  return response;
}

function escape(value: string): string {
  return value.replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);
}

const attr = escape;
