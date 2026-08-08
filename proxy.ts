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
 * Two rules keep it honest:
 * - No network calls. The proxy runs on prefetches, so an account.get() here
 *   would fire on every hover over a dashboard link.
 * - /api is deliberately outside the matcher. Redirecting an unauthenticated API
 *   call would hand the client a 200 HTML login page where it expects 401 JSON.
 */

const SESSION_COOKIE = `a_session_${process.env.NEXT_PUBLIC_APPWRITE_PROJECT_ID}`;

const AUTH_PATHS = new Set(["/login", "/signup"]);

export function proxy(request: NextRequest) {
  const hasSession = request.cookies.has(SESSION_COOKIE);
  const { pathname } = request.nextUrl;
  const isAuthPage = AUTH_PATHS.has(pathname);

  if (!hasSession && !isAuthPage) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    url.search = "";
    url.searchParams.set("next", pathname);
    return NextResponse.redirect(url);
  }

  if (hasSession && isAuthPage) {
    const url = request.nextUrl.clone();
    url.pathname = "/maps";
    url.search = "";
    return NextResponse.redirect(url);
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/maps/:path*", "/account/:path*", "/login", "/signup"],
};
