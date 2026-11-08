import type { Metadata } from "next";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";

import { SIDEBAR_MAP_COOKIE } from "@/components/layout/sidebar/sidebar-cookies";
import { MapList } from "@/components/maps/map-list";
import { Tutorial } from "@/components/onboarding/tutorial-overlay";
import { RoleProvider } from "@/components/team/role-context";
import { Container } from "@/components/ui/container";
import { requireUser } from "@/lib/auth/current-user";
import { shouldShowTutorial, tutorialAlwaysPresent } from "@/lib/auth/tutorial";
import { listMapSummaries } from "@/lib/repositories/map-summary.repository";
import { sidebarMapId } from "@/lib/repositories/maps.repository";
import { PLAN_LIMITS, getUserPlan } from "@/lib/repositories/plan-limits";
import { loadActiveContext } from "@/lib/team/resolve";
import { can } from "@/lib/team/roles";

export const metadata: Metadata = { title: "Maps" };

export default async function MapsPage(props: PageProps<"/maps">) {
  const user = await requireUser();
  // The workspace the dashboard is switched to — the person's own unless they
  // picked a team. The list, the map limit and New map are all that one's.
  const ctx = await loadActiveContext(user.id);

  /*
   * Back from a purchase (`CheckoutReturn` hops here from `/checkout/done`): on
   * to the map they were last working on, else the most recently edited one,
   * where `PurchaseCelebration` opens on the same `?checkout=done`. With no map
   * yet it opens over this list instead. The hop is a navigation our own page
   * started, so the Strict session cookie is on it (docs/notes/billing.md).
   */
  const { checkout } = await props.searchParams;

  if (checkout === "done") {
    const jar = await cookies();
    const mapId = await sidebarMapId(ctx, jar.get(SIDEBAR_MAP_COOKIE)?.value || null).catch(
      () => null,
    );

    if (mapId) redirect(`/maps/${mapId}?checkout=done`);
  }

  /*
   * What is on each map and when it last changed, so a card can say something
   * real instead of just its name. Three small reads per map, bounded by the Pro
   * plan's 15-map ceiling, and this is a dashboard page — never a visitor path,
   * so CLAUDE.md §2 is untouched. If maps per account ever grow past a handful,
   * denormalise the counts onto the map row.
   */
  const [entries, plan, unseen] = await Promise.all([
    listMapSummaries(ctx),
    getUserPlan(ctx.workspaceId),
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
    can(ctx.role, "edit") &&
    (entries.length === 0 || tutorialAlwaysPresent());

  return (
    <RoleProvider role={ctx.role}>
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
    </RoleProvider>
  );
}
