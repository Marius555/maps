import type { Metadata } from "next";

import { MapList } from "@/components/maps/map-list";
import { Container } from "@/components/ui/container";
import { requireUser } from "@/lib/auth/current-user";
import { repoContext } from "@/lib/repositories/context";
import { listMaps } from "@/lib/repositories/maps.repository";
import { countPlaces } from "@/lib/repositories/places.repository";
import { PLAN_LIMITS, getUserPlan } from "@/lib/repositories/plan-limits";

export const metadata: Metadata = { title: "Maps" };

export default async function MapsPage() {
  const user = await requireUser();
  const ctx = repoContext(user.id);
  const maps = await listMaps(ctx);

  /*
   * Counts per map, so a card can say something real instead of just its name.
   * One extra read each, bounded by the Pro plan's 15-map ceiling, and this is a
   * dashboard page — never a visitor path, so CLAUDE.md §2 is untouched. If maps
   * per account ever grow past a handful, denormalise a count onto the map row.
   */
  const [counts, plan] = await Promise.all([
    Promise.all(
      maps.map(async (map) => [map.id, await countPlaces(ctx, map.id)] as const),
    ),
    getUserPlan(user.id),
  ]);

  return (
    <Container>
      <MapList
        initialMaps={maps}
        placeCounts={Object.fromEntries(counts)}
        mapLimit={PLAN_LIMITS[plan].maps}
      />
    </Container>
  );
}
