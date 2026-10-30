import { ok } from "@/lib/api/responses";
import { withPersonalAuth } from "@/lib/api/route";
import { ACTIVE_WORKSPACE_COOKIE } from "@/lib/team/active-cookie";
import { listWorkspacesFor, resolveActiveContext } from "@/lib/team/resolve";

/**
 * The person's workspaces and which one is switched to — for pages outside the
 * dashboard shell that still have to say whose maps they are listing, like
 * /connect/wordpress. The dashboard reads the same thing in its layout.
 */
export const GET = withPersonalAuth(async ({ request, user }) => {
  const [workspaces, active] = await Promise.all([
    listWorkspacesFor(user.id, user.name || user.email),
    resolveActiveContext(user.id, request.cookies.get(ACTIVE_WORKSPACE_COOKIE)?.value),
  ]);

  return ok({ workspaces, activeWorkspaceId: active.workspaceId, role: active.role });
});
