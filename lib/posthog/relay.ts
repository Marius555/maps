import "server-only";

import { clientIp } from "@/lib/rate-limit/ip";

/**
 * The PostHog relay: what `app/rp/[...path]/route.ts` sends upstream and what
 * it hands back.
 *
 * **An allowlist both ways, never a copy.** The relay used to be a Next rewrite,
 * which forwards every request header — and on Appwrite Sites the request
 * reaching the app carries the runtime's own `Authorization: Basic opr:…` key,
 * plus the session cookie for anyone signed in, which in this app *is* the
 * Appwrite session secret. Both went to PostHog for a deploy. A header is only
 * forwarded here if PostHog needs it to read the request.
 */

export const RELAY_PATH = "/rp";

const REQUEST_HEADERS = ["accept", "accept-encoding", "content-encoding", "content-type", "origin", "user-agent"];

const RESPONSE_HEADERS = ["cache-control", "content-type", "etag", "last-modified"];

/**
 * The upstream URL for a relayed path, or null for anything the relay must not
 * reach. Scripts and remote config live on the `-assets` twin of the API host
 * (`eu.i.posthog.com` → `eu-assets.i.posthog.com`). The pathname is taken whole,
 * trailing slash included: PostHog's API paths end in one.
 */
export function relayTarget(pathname: string, search: string, host: string): string | null {
  if (!pathname.startsWith(`${RELAY_PATH}/`)) return null;
  const rest = pathname.slice(RELAY_PATH.length);
  if (rest.includes("..")) return null;

  const api = host.replace(/\/+$/, "");
  const assets = api.replace(/^(https?:\/\/[a-z]+)\.i\./, "$1-assets.i.");
  const base = rest.startsWith("/static/") || rest.startsWith("/array/") ? assets : api;
  return `${base}${rest}${search}`;
}

/**
 * The headers PostHog needs, and nothing else — never `authorization`,
 * `cookie`, `host` or any `x-*`. The visitor's address is passed as
 * `x-forwarded-for`, read the way `/api/collect` reads it, so PostHog's GeoIP
 * sees the visitor rather than Appwrite's edge.
 */
export function relayRequestHeaders(incoming: Headers): Headers {
  const out = new Headers();
  for (const name of REQUEST_HEADERS) {
    const value = incoming.get(name);
    if (value) out.set(name, value);
  }
  const ip = clientIp(incoming);
  if (ip !== "unknown") out.set("x-forwarded-for", ip);
  return out;
}

/**
 * The response headers worth keeping. `content-encoding` and `content-length`
 * are dropped because `fetch` has already decoded the body, and `set-cookie`
 * because PostHog must never set a cookie on our domain (the cookie policy).
 */
export function relayResponseHeaders(upstream: Headers): Headers {
  const out = new Headers();
  for (const name of RESPONSE_HEADERS) {
    const value = upstream.get(name);
    if (value) out.set(name, value);
  }
  return out;
}
