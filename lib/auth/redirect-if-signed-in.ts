import "server-only";

import { redirect } from "next/navigation";

import { getCurrentUser } from "./current-user";

/**
 * Bounce a signed-in visitor off `/login` and `/signup`.
 *
 * **This lives in the page and not in `proxy.ts`, and it cannot move back.** A
 * client-side navigation asks for a route as a flight payload, and a proxy
 * redirect answers it with a bare 307. `fetch` follows a 307 transparently and
 * the router cannot intercept it, so the body it decodes is the payload for
 * `/maps` against the request it made for `/login`. The decode dies on a row id
 * that has already resolved — `chunk.reason.enqueueModel is not a function` —
 * and the router falls back to a full page load. The destination is right and
 * the reload is invisible on a fast desktop, which is why this survived: on a
 * phone it is a white flash and a second download of the whole app.
 *
 * It cannot be fixed in the proxy. Next strips both `_rsc` and the `RSC` header
 * before `proxy()` runs — measured, not assumed — so the proxy cannot tell a
 * navigation from a document request, and cannot carry the cache-busting param
 * across the hop to keep the payload matched to the request.
 *
 * `redirect()` during a render is the mechanism that does work: on a document
 * request it is a 307, and on a flight request it is encoded *in the body*, so
 * the router applies it as a redirect instead of decoding a foreign payload.
 *
 * Costs a signed-out visitor nothing. `getCurrentUser()` returns null without a
 * network call when there is no cookie to read, which is every real visit to
 * these two pages.
 *
 * **Not in `(auth)/layout.tsx`.** The other pages in that group are exactly the
 * ones that must render *with* a session visible — `/auth/success` and
 * `/verify-email` are where a cross-site landing arrives precisely so that it is
 * not server-redirected to `/maps`. See *The SameSite trap* in
 * `docs/notes/auth.md`.
 */
export async function redirectIfSignedIn(): Promise<void> {
  if (await getCurrentUser()) redirect("/maps");
}
