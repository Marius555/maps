import { noContent, ok } from "@/lib/api/responses";
import { parseBody, withAuth } from "@/lib/api/route";
import {
  changeMemberRole,
  removeMember,
} from "@/lib/repositories/memberships.repository";
import { changeRoleSchema } from "@/lib/validation/team.schema";

type Params = { userId: string };

/** Change a member's role. Who may change whom is `canManage` (lib/team/roles.ts). */
export const PATCH = withAuth<Params>(async ({ request, params, ctx }) => {
  const { role } = await parseBody(request, changeRoleSchema);

  return ok({ membership: await changeMemberRole(ctx, params.userId, role) });
});

/** Take a member's access away. Their next request finds nothing here. */
export const DELETE = withAuth<Params>(async ({ params, ctx }) => {
  await removeMember(ctx, params.userId);

  return noContent();
});
