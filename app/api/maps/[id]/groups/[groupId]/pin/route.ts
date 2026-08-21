import { ok } from "@/lib/api/responses";
import { parseBody, withAuth } from "@/lib/api/route";
import { setGroupPin } from "@/lib/repositories/groups.repository";
import { setGroupPinSchema } from "@/lib/validation/group.schema";

type Params = { id: string; groupId: string };

/*
 * Sets one pin on every location in the group.
 *
 * Its own route rather than a field on the group's PATCH, because it does not
 * write the group at all — it writes the group's members. Putting `icon` beside
 * `name` and `color` in `updateGroupSchema` would have read as a column the
 * group has, and the whole point of this design is that it doesn't.
 *
 * Answers with the count so the client can say how many changed rather than
 * guessing from what it happened to have cached.
 */
export const PATCH = withAuth<Params>(async ({ request, params, ctx }) => {
  const input = await parseBody(request, setGroupPinSchema);
  const count = await setGroupPin(ctx, params.id, params.groupId, input.icon);

  return ok({ count });
});
