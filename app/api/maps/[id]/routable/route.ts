import { ok } from "@/lib/api/responses";
import { parseBody, withAuth } from "@/lib/api/route";
import { routerFailure } from "@/lib/api/router-errors";
import { getMap } from "@/lib/repositories/maps.repository";
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

  const input = await parseBody(request, routableSchema);

  try {
    const router = getRouter();

    /*
     * Sequential, deliberately. Every call goes through one process-wide
     * throttle, so firing them at once would only queue them in a less
     * predictable order — and a `Promise.all` over a rejected member would
     * abandon answers already paid for.
     */
    const results: boolean[] = [];
    for (const point of input.points) {
      results.push(isRoutableSnap(await router.nearest(point, input.profile)));
    }

    return ok({ results });
  } catch (error) {
    return routerFailure(error);
  }
});
