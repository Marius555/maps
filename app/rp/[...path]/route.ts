import type { NextRequest } from "next/server";

import { relayRequestHeaders, relayResponseHeaders, relayTarget } from "@/lib/posthog/relay";

/**
 * The PostHog relay. The browser loads PostHog's scripts and posts its events
 * here, on our own origin, because tracker blocklists carry `*.posthog.com`;
 * this forwards them to `NEXT_PUBLIC_POSTHOG_HOST`.
 *
 * **Built from an allowlist, not a rewrite** — lib/posthog/relay.ts says why:
 * a rewrite forwarded Appwrite's runtime key and the session cookie.
 *
 * Neither `withAuth` nor `withoutAuth`, on the same reasoning as `/api/collect`:
 * nobody is signed in to send analytics. Outside `proxy.ts`'s matcher, and
 * exempt from the trailing-slash redirect in next.config.ts, because PostHog's
 * paths end in a slash. Dashboard and marketing pages only — the embed never
 * loads PostHog (§2).
 */
export const dynamic = "force-dynamic";

const host = process.env.NEXT_PUBLIC_POSTHOG_HOST;

async function relay(request: NextRequest): Promise<Response> {
  const target = host ? relayTarget(request.nextUrl.pathname, request.nextUrl.search, host) : null;
  if (!target) return new Response(null, { status: 404 });

  const hasBody = request.method !== "GET" && request.method !== "HEAD";
  try {
    const upstream = await fetch(target, {
      method: request.method,
      headers: relayRequestHeaders(request.headers),
      body: hasBody ? await request.arrayBuffer() : undefined,
      redirect: "manual",
      cache: "no-store",
    });
    return new Response(upstream.body, {
      status: upstream.status,
      headers: relayResponseHeaders(upstream.headers),
    });
  } catch {
    // PostHog unreachable: it retries, and analytics never breaks a page.
    return new Response(null, { status: 502 });
  }
}

export { relay as GET, relay as POST, relay as OPTIONS };
