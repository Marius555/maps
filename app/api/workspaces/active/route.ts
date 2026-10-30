import { ok } from "@/lib/api/responses";
import { parseBody, withPersonalAuth } from "@/lib/api/route";
import { asWorkspaceId } from "@/lib/repositories/context";
import { NotFoundError } from "@/lib/repositories/errors";
import { clearActiveWorkspace, setActiveWorkspace } from "@/lib/team/active-cookie-store";
import { workspaceRoleFor } from "@/lib/team/resolve";
import { switchWorkspaceSchema } from "@/lib/validation/team.schema";

/**
 * Switch the dashboard to a workspace this person belongs to.
 *
 * `"none"` scope: switching is about the person, not about a workspace's data,
 * so a viewer can switch as freely as an owner. The cookie it sets is a hint
 * that every later request checks again; this check is only so a bad id is an
 * error here rather than a silent fallback later.
 */
export const POST = withPersonalAuth(
  async ({ request, user }) => {
    const { workspaceId } = await parseBody(request, switchWorkspaceSchema);

    if (workspaceId === user.id) {
      await clearActiveWorkspace();

      return ok({ workspaceId });
    }

    if (!(await workspaceRoleFor(asWorkspaceId(workspaceId), user.id))) {
      throw new NotFoundError("You're not on that team any more.");
    }

    await setActiveWorkspace(workspaceId);

    return ok({ workspaceId });
  },
  { allowUnverified: true },
);
