import { ok } from "@/lib/api/responses";
import { withAuth } from "@/lib/api/route";
import { loadTeamOverview } from "@/lib/team/overview";

/** Who is on the switched-to workspace, and which invites are out. */
export const GET = withAuth(async ({ ctx }) => ok({ team: await loadTeamOverview(ctx) }));
