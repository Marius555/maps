import type { Metadata } from "next";

import { MapList } from "@/components/maps/map-list";
import { Container } from "@/components/ui/container";
import { requireUser } from "@/lib/auth/current-user";
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
  const [entries, plan] = await Promise.all([
    listMapSummaries(repoContext(user.id)),
    getUserPlan(user.id),
  ]);

  return (
    <Container>
      <MapList
        initialMaps={entries.map((entry) => entry.map)}
        summaries={Object.fromEntries(
          entries.map((entry) => [entry.map.id, entry.summary]),
        )}
        mapLimit={PLAN_LIMITS[plan].maps}
      />
    </Container>
  );
}
