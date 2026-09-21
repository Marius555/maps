import { ok } from "@/lib/api/responses";
import { parseBody, withAuth } from "@/lib/api/route";
import { routerFailure } from "@/lib/api/router-errors";
import { getMap } from "@/lib/repositories/maps.repository";
import { assertPlanFeature } from "@/lib/repositories/plan-limits";
import {
  assertLookupHeadroom,
  recordLookups,
} from "@/lib/repositories/usage.repository";
import { getRouter } from "@/lib/routing";
import { directionsSchema } from "@/lib/validation/directions.schema";

type Params = { id: string };

/**
 * Roads between stops, asked once when the owner draws or recalculates a route.
 *
 * This is the whole cost of the feature, and it is deliberately here rather than
 * in the visitor's path: the answer is baked into the shape's geometry and
 * published as plain coordinates, so a map with a route on it makes exactly the
 * same requests as one without (CLAUDE.md §2). Nothing recomputes on a pin drag,
 * on a publish, or on a page load.
 *
 * Scoped under a map the caller owns for the reason the geocode route gives: an
 * unscoped routing endpoint is a free proxy for anyone who finds it. The body
 * carries coordinates only — never a URL — so this cannot be pointed at
 * something else.
 *
 * `route: null` is a real answer, not an error: the engine worked and there is
 * no drivable way between the stops. The client says so rather than showing a
 * failure — and `unreachableStop` is how it says *which* stop, when the engine
 * named one. Without it the only honest message is that something among the
 * stops has no road near it, which is not a thing anybody can act on.
 */
export const POST = withAuth<Params>(async ({ request, params, ctx }) => {
  await getMap(ctx, params.id);
  await assertPlanFeature(ctx.userId, "routes");

  const input = await parseBody(request, directionsSchema);

  /*
   * One lookup, whatever the stop count. The engine takes every waypoint in a
   * single call, so a twenty-five-stop route costs what a two-stop route costs —
   * which is also why this endpoint was never the expensive half of the feature.
   * The sweep in `routable` is, and it is metered per point.
   */
  await assertLookupHeadroom(ctx.userId, 1, "interactive");

  try {
    const outcome = await getRouter().route({
      stops: input.stops,
      profile: input.profile,
    });

    await recordLookups(ctx.userId, 1);

    return ok(outcome);
  } catch (error) {
    return routerFailure(error);
  }
});
