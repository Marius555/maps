import { ok } from "@/lib/api/responses";
import { withAuth } from "@/lib/api/route";
import { publishMap } from "@/lib/repositories/publish.repository";

type Params = { id: string };

/**
 * Regenerates the map's static snapshot and points the live URL at it.
 *
 * The only write in the app that produces something a stranger's browser will
 * fetch, so it takes no body: what gets published is always the map's current
 * saved state, never a payload the client composed.
 *
 * **This used to carry the email gate by hand and no longer does.** It was the
 * first and for a while the only action that needed a confirmed address; now
 * every write does, and the check moved to `withAuth`, which is the one place it
 * can cover a route nobody remembered to add it to. The 403 an unconfirmed
 * account gets here is the same one it gets everywhere else.
 *
 * **The gate never belonged inside `publishMap`, and still doesn't.** `withAuth`
 * has already resolved a real Appwrite user, so `emailVerified` is a fact rather
 * than a cookie's claim — and the repository has no such user to read. Its other
 * caller is the nightly sheet sync (`lib/sheet-sync/run.ts`), which republishes
 * an already-live map for a paying customer from a cron with no session at all.
 * A check down that layer would either break that or make every sync pay for an
 * extra Appwrite lookup to answer a question settled at signup. See
 * `docs/notes/auth.md`.
 */
export const POST = withAuth<Params>(async ({ request, params, ctx }) => {
  // The origin is read from the request rather than configured, so a self-hosted
  // or preview deployment publishes URLs that point at itself.
  return ok(await publishMap(ctx, params.id, new URL(request.url).origin));
});
