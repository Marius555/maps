import "server-only";

import { readIp } from "@/lib/analytics/collect/geo-headers";

/**
 * The address a request is counted against, for the policies keyed by IP.
 *
 * The same reading the analytics collector uses — `x-appwrite-client-ip`, which
 * Appwrite's edge sets, and then the first `x-forwarded-for` entry. The second
 * is settable by the client, and that is accepted knowingly: **the failure it
 * allows is evasion, never lockout.** Somebody rotating the header escapes a
 * per-IP counter (the per-email and per-account ones still hold). The
 * alternative readings — the proxy's own trailing entry, or nothing — would put
 * every visitor behind one shared address, and then one person's flood would
 * refuse signup to everybody.
 *
 * Whether Appwrite overwrites a client-sent `x-appwrite-client-ip` is checked by
 * hand after each hosting change; docs/notes/limits.md says how.
 *
 * With no address at all (a local dev server has none) every request shares one
 * bucket, which on a laptop is one person anyway.
 */
export function clientIp(headers: Headers): string {
  return readIp(headers) ?? "unknown";
}
