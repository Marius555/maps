import type { Metadata } from "next";

import { MapList } from "@/components/maps/map-list";
import { Tutorial } from "@/components/onboarding/tutorial-overlay";
import { Container } from "@/components/ui/container";
import { requireUser } from "@/lib/auth/current-user";
import { shouldShowTutorial, tutorialAlwaysPresent } from "@/lib/auth/tutorial";
import { repoContext } from "@/lib/repositories/context";
import { listMapSummaries } from "@/lib/repositories/map-summary.repository";
import { PLAN_LIMITS, getUserPlan } from "@/lib/repositories/plan-limits";

export const metadata: Metadata = { title: "Maps" };

export default async function MapsPage() {
  const user = await requireUser();

  /*
   * What is on each map and when it last changed, so a card can say something
   * real instead of just its name. Three small reads per map, bounded by the Pro
   * plan's 15-map ceiling, and this is a dashboard page — never a visitor path,
   * so CLAUDE.md §2 is untouched. If maps per account ever grow past a handful,
   * denormalise the counts onto the map row.
   */
  const [entries, plan, unseen] = await Promise.all([
    listMapSummaries(repoContext(user.id)),
    getUserPlan(user.id),
    shouldShowTutorial(user.id, "maps"),
  ]);

  /*
   * The overlay points at Create map, so it is for an account with no map yet —
   * an older account that has never closed it but already has maps does not
   * need showing where the button is. `TUTORIAL_ALWAYS_PRESENT` overrides that,
   * so it can be looked at on an account with maps.
   *
   * Never while the button is greyed for an unconfirmed address — the same
   * `emailVerified` that `CreateMapDialog` reads: an arrow at a control that
   * does nothing teaches the wrong thing, and the banner above already says
   * what to do first. Nothing is stamped, so it is waiting once they confirm.
   */
  const showTutorial =
    unseen &&
    user.emailVerified &&
    (entries.length === 0 || tutorialAlwaysPresent());

  return (
    <Container>
      <MapList
        initialMaps={entries.map((entry) => entry.map)}
        summaries={Object.fromEntries(
          entries.map((entry) => [entry.map.id, entry.summary]),
        )}
        mapLimit={PLAN_LIMITS[plan].maps}
      />
      {showTutorial ? <Tutorial id="maps" /> : null}
    </Container>
  );
}
