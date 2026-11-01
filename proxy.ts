import { NextResponse, type NextRequest } from "next/server";

import { bearerToken, verifyIdToken } from "@/lib/shopify/id-token";
import { appOrigin, bounceRedirect, intoAdminRedirect } from "@/lib/shopify/bounce";
import { allowFramingBy } from "@/lib/shopify/framing";
import { parseShopDomain } from "@/lib/shopify/shop-domain";

/**
 * Next 16 replaced middleware.ts with proxy.ts. The runtime is always nodejs and
 * cannot be configured — declaring `export const runtime` here throws.
 *
 * This file saves a wasted render for signed-out visitors. It authorizes nothing.
 * A forged cookie sails straight past it and is stopped twice more:
 *   1. app/(dashboard)/layout.tsx calls getCurrentUser(), which hits Appwrite.
 *   2. every route handler calls requireUser() independently.
 *
 * Three rules keep it honest:
 * - No network calls. The proxy runs on prefetches, so an account.get() here
 *   would fire on every hover over a dashboard link.
 * - /api is deliberately outside the matcher. Redirecting an unauthenticated API
 *   call would hand the client a 200 HTML login page where it expects 401 JSON.
 * - It only ever redirects *towards* /login, never away from it. Bouncing a
 *   signed-in visitor off /login belonged here once and cost a full page reload
 *   on every such visit: a proxy redirect answers a client-side navigation's
 *   flight request with a bare 307, which `fetch` follows into the wrong route's
 *   payload. Next strips `_rsc` and the `RSC` header before this function runs,
 *   so a redirect here cannot be made navigation-aware. That bounce is now
 *   `redirectIfSignedIn()`, called by the two pages that want it.
 *
 * The signed-out direction keeps its 307 on purpose. It answers a document
 * request — a typed URL or an old bookmark — and the one navigation that can
 * reach it, a session expiring with the dashboard open, *should* end in a reload.
 *
 * **The Shopify admin is the one other caller, and it is handled first**
 * (`shopifyEmbedded`, docs/notes/shopify.md). Its pages carry no cookie at all;
 * they carry a Shopify ID token, verified here locally (an HMAC, no network
 * call, so the first rule holds). Its redirects never answer a flight request:
 * a navigation inside the admin always has App Bridge's `Authorization` header,
 * and a bad header is a 401 App Bridge retries, never a 307.
 */

const SESSION_COOKIE = `a_session_${process.env.NEXT_PUBLIC_APPWRITE_PROJECT_ID}`;

export function proxy(request: NextRequest) {
  const shopify = shopifyEmbedded(request);
  if (shopify) return shopify;

  const response = isDashboardPath(request.nextUrl.pathname)
    ? guardDashboard(request)
    : // Matched only because the admin loaded it (`embedded=1`); nothing to guard.
      NextResponse.next();

  // next.config.ts leaves framing to this file on a document the Shopify admin
  // loaded (`embedded=1`). One that was not granted its shop's admin above keeps
  // the site-wide rule, so no path is frameable by omission.
  if (request.nextUrl.searchParams.get("embedded") === "1") sameOriginFraming(response);

  return response;
}

const DASHBOARD_PATHS = ["/maps", "/account", "/settings", "/notifications"];

function isDashboardPath(pathname: string): boolean {
  return DASHBOARD_PATHS.some((path) => pathname === path || pathname.startsWith(`${path}/`));
}

/** The web app's guard: a session cookie, or a 307 to /login. */
function guardDashboard(request: NextRequest): NextResponse {
  if (request.cookies.has(SESSION_COOKIE)) return NextResponse.next();

  const { pathname } = request.nextUrl;
  const url = request.nextUrl.clone();
  url.pathname = "/login";
  url.search = "";
  url.searchParams.set("next", pathname);
  return NextResponse.redirect(url);
}

/** The site-wide framing rule, which next.config.ts does not send on `embedded=1` documents. */
function sameOriginFraming(response: NextResponse): void {
  response.headers.set("X-Frame-Options", "SAMEORIGIN");
  response.headers.set("Content-Security-Policy", "frame-ancestors 'self'");
}

/**
 * Requests from inside the Shopify admin, or null for every other request.
 *
 * - **A token that verifies** — App Bridge's `Authorization` header, or the
 *   `id_token` the admin puts on every document it loads — goes on, with the
 *   token moved into the `Authorization` request header (so
 *   `lib/auth/shopify-user.ts` reads one place) and framing opened to that shop
 *   and the admin only. The root (`/?shop=…`, our `application_url`) goes to the
 *   App Home instead, which is where installing happens.
 * - **A header that does not verify** is a 401 with Shopify's retry header:
 *   App Bridge fetches a fresh token and repeats the request.
 * - **A document the admin loaded without a usable token** goes to the bounce
 *   page, where App Bridge reloads it with a fresh one.
 * - **The root with a shop but outside the admin** (`/?shop=x.myshopify.com`,
 *   a link opened in a new tab) is sent into the admin, because the app only
 *   works embedded.
 */
function shopifyEmbedded(request: NextRequest): NextResponse | null {
  const keys = {
    clientId: process.env.SHOPIFY_CLIENT_ID ?? "",
    clientSecret: process.env.SHOPIFY_CLIENT_SECRET ?? "",
  };
  if (!keys.clientId || !keys.clientSecret) return null;

  const { pathname, searchParams } = request.nextUrl;
  const header = bearerToken(request.headers.get("authorization"));
  const token = header ?? searchParams.get("id_token");
  const embedded = searchParams.get("embedded") === "1";
  const shopParam = parseShopDomain(searchParams.get("shop"));

  if (!token && !embedded && !(pathname === "/" && shopParam)) return null;

  const verified = token ? verifyIdToken(token, keys) : null;

  if (verified) {
    if (pathname === "/") {
      // On the configured origin, not the request's (`appOrigin`).
      const home = new URL("/shopify", appOrigin(request));
      home.search = request.nextUrl.search;
      return NextResponse.redirect(home);
    }

    const forwarded = new Headers(request.headers);
    forwarded.set("authorization", `Bearer ${token}`);

    const response = NextResponse.next({ request: { headers: forwarded } });
    allowFramingBy(response, verified.shop);
    return response;
  }

  if (header) {
    return new NextResponse(null, {
      status: 401,
      headers: { "X-Shopify-Retry-Invalid-Session-Request": "1" },
    });
  }

  if (embedded && shopParam) return bounceRedirect(request, shopParam);

  if (pathname === "/" && shopParam) return intoAdminRedirect(shopParam, keys.clientId);

  return null;
}

export const config = {
  matcher: [
    "/maps/:path*",
    "/account/:path*",
    "/settings/:path*",
    "/notifications/:path*",
    // The Shopify app's `application_url`. Only when a shop is named, so the
    // landing page stays static for everybody else.
    { source: "/", has: [{ type: "query", key: "shop" }] },
    // Every document the Shopify admin loads, for its framing headers
    // (next.config.ts sends none on these). Not the bounce page, which the
    // proxy would bounce to itself, and which frames itself per shop; not the
    // operator console, whose own `frame-ancestors 'none'` must stand.
    {
      source: "/((?!api/|_next/|shopify/session-token|admin(?:/|$)|login/admin).*)",
      has: [{ type: "query", key: "embedded", value: "1" }],
    },
  ],
};
