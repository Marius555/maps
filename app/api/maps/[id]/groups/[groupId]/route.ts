import { noContent, ok } from "@/lib/api/responses";
import { parseBody, withAuth } from "@/lib/api/route";
import {
  deleteGroup,
  getGroup,
  updateGroup,
} from "@/lib/repositories/groups.repository";
import { updateGroupSchema } from "@/lib/validation/group.schema";

type Params = { id: string; groupId: string };

export const GET = withAuth<Params>(async ({ params, ctx }) =>
  ok({ group: await getGroup(ctx, params.id, params.groupId) }),
);

export const PATCH = withAuth<Params>(async ({ request, params, ctx }) => {
  const input = await parseBody(request, updateGroupSchema);
  return ok({ group: await updateGroup(ctx, params.id, params.groupId, input) });
});

/*
 * Deletes the group only. Its members keep a `groupId` pointing at nothing,
 * which the client reads as ungrouped — see groups.repository.ts for why that
 * beats one PATCH per member from inside a request that can half-fail.
 */
export const DELETE = withAuth<Params>(async ({ params, ctx }) => {
  await deleteGroup(ctx, params.id, params.groupId);
  return noContent();
});
