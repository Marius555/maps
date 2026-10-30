import { noContent } from "@/lib/api/responses";
import { withPersonalAuth } from "@/lib/api/route";
import { asWorkspaceId } from "@/lib/repositories/context";
import { leaveWorkspace } from "@/lib/repositories/memberships.repository";
import { clearActiveWorkspace, readActiveWorkspace } from "@/lib/team/active-cookie-store";

type Params = { workspaceId: string };

/**
 * Leave a team you joined.
 *
 * `"none"` scope and the id in the path, so it works for every role — a viewer
 * must be able to leave, and the viewer gate would otherwise refuse the DELETE.
 * Leaving the team the dashboard is switched to switches it home.
 */
export const DELETE = withPersonalAuth<Params>(
  async ({ params, user }) => {
    await leaveWorkspace(user.id, asWorkspaceId(params.workspaceId));

    if ((await readActiveWorkspace()) === params.workspaceId) await clearActiveWorkspace();

    return noContent();
  },
  { allowUnverified: true },
);
