import { ok } from "@/lib/api/responses";
import { parseBody, withAuth } from "@/lib/api/route";
import { routerFailure } from "@/lib/api/router-errors";
import { getMap } from "@/lib/repositories/maps.repository";
import { assertPlanFeature } from "@/lib/repositories/plan-limits";
import {
  assertLookupHeadroom,
  recordLookups,
} from "@/lib/repositories/usage.repository";
import { getRouter, isRoutableSnap } from "@/lib/routing";
import { routableSchema } from "@/lib/validation/routable.schema";

type Params = { id: string };

/**
 * Whether these locations can be stops on a route.
 *
 * The question a route tool needs answered *before* a click, and the only way to
 * answer it is to ask the engine: a pin in the middle of a field looks exactly
 * like a pin outside a shop until something tries to attach it to a road. Asking
 * afterwards is what the directions route already does, and by then the user has
 * drawn a route that cannot exist.
 *
 * Like directions, this runs when the owner is drawing and never when a visitor
 * loads a map (CLAUDE.md §2). Nothing here is baked into anything published; a
 * refusal only greys a pin in the editor.
 *
 * Scoped under a map the caller owns for the reason the geocode and directions
 * routes give: unscoped, it is a free routing proxy for anyone who finds it.
 *
 * Answers are booleans rather than distances. The threshold is a judgement the
 * server owns (lib/routing/routable.ts) and the client has no use for the metres
 * — sending them would invite a second, disagreeing rule in the browser.
 */
export const POST = withAuth<Params>(async ({ request, params, ctx }) => {
  await getMap(ctx, params.id);
  await assertPlanFeature(ctx.userId, "routes");

  const input = await parseBody(request, routableSchema);

  /*
   * One lookup per point, and **the only `background` spender among the editor's
   * routes.** This is the affordance that greys unreachable pins before they are
   * clicked; nobody presses it and nobody waits for it, so when the app's shared
   * daily budget runs low it is the first thing that should stand aside. The pins
   * simply stay as they are, which is what the sweep's own failure path already
   * does — see `use-routability.ts`, where a failure is silence by design.
   *
   * It is also the largest single spender in the product: arming the tool sweeps
   * up to `ROUTE_PROBE_LIMIT` pins, and on Geoapify each one bills as a reverse
   * geocode because that adapter has no native `nearest`.
   */
  await assertLookupHeadroom(ctx.userId, input.points.length, "background");

  /*
   * Declared out here so the catch can still read it.
   *
   * The loop is sequential, so its length is exactly how many points the engine
   * answered before anything went wrong — and those were real upstream requests
   * whether or not the caller ever sees them. Billing the whole batch would charge
   * for work nobody did; billing none of it would make a failing sweep the cheapest
   * way to spend the day's budget.
   */
  const results: boolean[] = [];

  try {
    const router = getRouter();

    /*
     * Sequential, deliberately. Every call goes through one process-wide
     * throttle, so firing them at once would only queue them in a less
     * predictable order — and a `Promise.all` over a rejected member would
     * abandon answers already paid for.
     */
    for (const point of input.points) {
      results.push(isRoutableSnap(await router.nearest(point, input.profile)));
    }

    await recordLookups(ctx.userId, results.length);

    return ok({ results });
  } catch (error) {
    await recordLookups(ctx.userId, results.length);

    return routerFailure(error);
  }
});
