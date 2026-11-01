import { NextResponse, type NextRequest } from "next/server";

/**
 * Send a document the Shopify admin loaded without a usable ID token to App
 * Bridge's bounce page (`app/shopify/session-token/route.ts`), told to reload
 * this same URL once it has a fresh token. The stale token is dropped from
 * both, so the reload cannot carry it back.
 *
 * Shared by `proxy.ts` and the App Home. Pure — no network call — because the
 * proxy may make none.
 */
export function bounceRedirect(request: NextRequest, shop: string): NextResponse {
  const origin = appOrigin(request);

  const params = new URLSearchParams(request.nextUrl.searchParams);
  params.delete("id_token");
  params.delete("shopify-reload");
  params.set("shop", shop);

  const reload = `${origin}${request.nextUrl.pathname}?${params.toString()}`;

  const bounce = new URL("/shopify/session-token", origin);
  bounce.search = params.toString();
  bounce.searchParams.set("shopify-reload", reload);

  return NextResponse.redirect(bounce);
}

/**
 * The origin every Shopify-side redirect is built on: the configured
 * `APP_URL`, never the request's own (docs/notes/auth.md — "`env.appUrl` is
 * configured, never read from the request").
 *
 * This is not only that rule. Behind `shopify app dev`'s proxy and tunnel,
 * `request.nextUrl.origin` is `https://localhost:<port>` — the internal address
 * with the tunnel's protocol — and the App Home's redirect to `/maps` sent the
 * admin's frame there: "localhost sent an invalid response". Measured
 * 2026-11-01. `scripts/shopify-dev.mjs` points `APP_URL` at the tunnel.
 * Falls back to the request only where `APP_URL` is unset, which is plain
 * local development, where the two agree.
 */
export function appOrigin(request: NextRequest): string {
  return (process.env.APP_URL || request.nextUrl.origin).replace(/\/+$/, "");
}

/** Shopify's own address for "this app, inside this shop's admin". */
export function intoAdminRedirect(shop: string, clientId: string): NextResponse {
  return NextResponse.redirect(`https://${shop}/admin/apps/${clientId}`);
}
