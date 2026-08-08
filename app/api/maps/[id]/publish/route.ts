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
 */
export const POST = withAuth<Params>(async ({ params, ctx }) =>
  ok(await publishMap(ctx, params.id)),
);
