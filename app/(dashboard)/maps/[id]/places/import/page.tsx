import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { ImportWizard } from "@/components/places/import/import-wizard";
import { Container } from "@/components/ui/container";
import { PageTitle } from "@/components/ui/page-title";
import { requireUser } from "@/lib/auth/current-user";
import { repoContext } from "@/lib/repositories/context";
import { NotFoundError } from "@/lib/repositories/errors";
import { loadMap } from "@/lib/repositories/load-map";
import { PLAN_LIMITS, getUserPlan } from "@/lib/repositories/plan-limits";
import { countPlaces } from "@/lib/repositories/places.repository";
import type { AppMap } from "@/lib/repositories/types";

export const metadata: Metadata = { title: "Import locations" };

export default async function ImportPage(
  props: PageProps<"/maps/[id]/places/import">,
) {
  const { id } = await props.params;
  const user = await requireUser();

  // The try wraps only the fetch — see the settings page for why.
  let map: AppMap;

  try {
    map = await loadMap(user.id, id);
  } catch (error) {
    if (error instanceof NotFoundError) notFound();
    throw error;
  }

  /**
   * How much room is left, resolved here so the wizard can say so before the
   * user waits out a geocoding pass they were never going to be allowed to save.
   *
   * Advisory only. `createPlaces` re-checks and rejects server-side, which is
   * where CLAUDE.md §6 requires the actual enforcement to live — this is the
   * courtesy of saying it early, not the rule.
   *
   * In parallel, like `loadPlaces` on the Locations page. Neither of these needs
   * the other and they used to be awaited one after the next, which is a third
   * round trip's worth of skeleton for nothing.
   */
  const [plan, used] = await Promise.all([
    getUserPlan(user.id),
    countPlaces(repoContext(user.id), id),
  ]);

  /*
   * The heading is `sr-only`. The sidebar's lit "Locations" row and the step trail
   * at the top of the wizard already say where this is and how far through it you
   * are; a title drawn over them was a third answer to a question nobody had.
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
       * Centred down the page as well as across it, and `my-auto` is what does
       * it rather than `justify-center`.
       *
       * The difference only shows on the two tall steps. When a flex item has
       * negative free space, auto margins resolve to zero and the item aligns to
       * the start — so Columns and Review scroll from their top edge exactly as
       * they do today. `justify-content: center` would instead push their top
       * above the scroll container, where nothing can reach it.
       *
       * `Container` is already `flex-1` inside `<main class="flex min-h-0
       * flex-1 flex-col">` under a `min-h-[100dvh]` shell, so the height to
       * divide up is there without anything new being measured. `PageTitle` is
       * `sr-only` and takes none of it.
       */}
      <div className="my-auto w-full">
        <ImportWizard
          map={map}
          headroom={{ plan, limit: PLAN_LIMITS[plan].places, used }}
        />
      </div>
    </Container>
  );
}
