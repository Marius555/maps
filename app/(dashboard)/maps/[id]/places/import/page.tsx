import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { ImportWizard } from "@/components/places/import/import-wizard";
import { ViewOnlyEmpty } from "@/components/team/view-only-empty";
import { Container } from "@/components/ui/container";
import { PageTitle } from "@/components/ui/page-title";
import { requireUser } from "@/lib/auth/current-user";
import { NotFoundError } from "@/lib/repositories/errors";
import {
  PLAN_LIMITS,
  getUserPlan,
  planAllows,
} from "@/lib/repositories/plan-limits";
import { countPlaces } from "@/lib/repositories/places.repository";
import type { AppMap } from "@/lib/repositories/types";
import { loadMapAccess } from "@/lib/team/resolve";
import { can, type WorkspaceRole } from "@/lib/team/roles";

export const metadata: Metadata = { title: "Import locations" };

export default async function ImportPage(
  props: PageProps<"/maps/[id]/places/import">,
) {
  const { id } = await props.params;
  const user = await requireUser();

  /**
   * The map, and how much room is left on it — resolved here so the wizard can
   * say so before the user waits out a geocoding pass they were never going to
   * be allowed to save.
   *
   * The headroom is advisory only. `createPlaces` re-checks and rejects
   * server-side, which is where CLAUDE.md §6 requires the actual enforcement to
   * live — this is the courtesy of saying it early, not the rule.
   *
   * Access first, because it names the workspace whose plan sets the headroom
   * — the map's owner's, which for a team member is not their own — and then
   * the other two in parallel. The try wraps only the fetch — see the
   * Locations page for why.
   */
  let map: AppMap;
  let role: WorkspaceRole;
  let plan: Awaited<ReturnType<typeof getUserPlan>>;
  let used: number;

  try {
    const access = await loadMapAccess(user.id, id);

    map = access.map;
    role = access.ctx.role;
    [plan, used] = await Promise.all([
      getUserPlan(access.ctx.workspaceId),
      countPlaces(access.ctx, id),
    ]);
  } catch (error) {
    if (error instanceof NotFoundError) notFound();
    throw error;
  }

  /*
   * The heading is `sr-only`. The Source step draws the same words itself
   * (`ImportHeading`, title `aria-hidden`), and the three working steps draw
   * none — the sidebar's lit "Locations" row already says where this is.
   */
  return (
    /*
     * `content`, not `centered`, and the wizard caps itself instead. The column
     * table on the Columns step and the map on the Review step both need more
     * than `max-w-5xl`, and the two narrow steps still get it — see `isWide` in
     * import-wizard.tsx. `loading.tsx` mirrors this and the Source step's width.
     */
    <Container size="content" className="flex flex-col">
      <PageTitle>Import locations</PageTitle>

      {/*
       * `flex flex-col` on the Container is what lets the wizard centre its
       * narrow steps down the page with `my-auto`. The wizard decides which steps
       * that is; see `isWide` there. `Container` is already `flex-1` inside
       * `<main class="flex min-h-0 flex-1 flex-col">`, so the height to divide
       * up is there without anything new being measured. `PageTitle` is
       * `sr-only` and takes none of it.
       */}
      {can(role, "edit") ? (
        <ImportWizard
          map={map}
          headroom={{ plan, limit: PLAN_LIMITS[plan].places, used }}
          canSyncSheets={planAllows(plan, "sheetSync")}
        />
      ) : (
        <ViewOnlyEmpty
          title="Importing needs editor access"
          backHref={`/maps/${map.id}/places`}
          backLabel="Back to locations"
        />
      )}
    </Container>
  );
}
