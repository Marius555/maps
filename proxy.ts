import { NextResponse, type NextRequest } from "next/server";

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
 */

const SESSION_COOKIE = `a_session_${process.env.NEXT_PUBLIC_APPWRITE_PROJECT_ID}`;

export function proxy(request: NextRequest) {
  if (request.cookies.has(SESSION_COOKIE)) return NextResponse.next();

  const { pathname } = request.nextUrl;
  const url = request.nextUrl.clone();
  url.pathname = "/login";
  url.search = "";
  url.searchParams.set("next", pathname);
  return NextResponse.redirect(url);
}

export const config = {
  matcher: ["/maps/:path*", "/account/:path*"],
};
