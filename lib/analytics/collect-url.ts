/**
 * Where a published map posts what its visitors did.
 *
 * Shaped exactly like `gazetteerBase` in lib/gazetteer/config.ts and
 * `embedScriptUrl` in lib/embed/snippet.ts, and for the same reason: point
 * `NEXT_PUBLIC_COLLECT_URL` somewhere else in production, and leave it unset for
 * development and self-hosting, where the app answers on its own origin and
 * there is nothing to configure.
 *
 * **Absolute, always.** The embed runs on a customer's page, so a relative path
 * would post to *their* server — which would silently 404 on every site but
 * ours, and on the sites where it did not 404, would hand their backend our
 * payload. Nothing here may return a path.
 *
 * Client-safe on purpose. `buildSnapshot` is pure and runs in the browser for
 * the publish preview, so this file must not grow a `server-only` import; the
 * variable is `NEXT_PUBLIC_` for the same reason.
 */

/** The collector route. One path, named in one place. */
export const COLLECT_PATH = "/api/collect";

export function collectUrl(origin: string): string {
  return process.env.NEXT_PUBLIC_COLLECT_URL || `${origin}${COLLECT_PATH}`;
}
