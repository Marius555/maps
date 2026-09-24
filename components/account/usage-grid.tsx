import { Map as MapIcon, MapPin, Search, Shapes } from "lucide-react";

import type { LookupUsage } from "@/lib/repositories/usage.repository";
import type { PlanId } from "@/lib/repositories/plan-limits";
import { PLAN_LIMITS } from "@/lib/repositories/plan-limits";
import { UsageMeter } from "./usage-meter";

/**
 * Everything this account has a ceiling on, measured.
 *
 * **Four numbers rather than one.** The page used to show address lookups alone,
 * which is the only limit in the product a customer cannot see by looking at what
 * they built — the argument for showing it has not changed. But it meant the page
 * answered "how much of my plan am I using?" with a quarter of the answer, and
 * sent the other three-quarters to `/pricing` as a table of numbers with no
 * relation to anything the reader had.
 *
 * Three of them are per-map limits and one is per-account, and that difference is
 * said in the note rather than in the layout: the locations and shapes meters
 * report the **fullest** map, because the ceiling is per map and the map nearest
 * to it is the one that will refuse something first. Naming that map is what makes
 * the number actionable — "24 of 25" with no map attached is a riddle on an
 * account with fifteen of them.
 */
export function UsageGrid({
  plan,
  mapCount,
  places,
  shapes,
  lookups,
}: {
  plan: PlanId;
  mapCount: number;
  /** The fullest map by locations, or null when there are no maps yet. */
  places: { count: number; mapName: string } | null;
  /** The fullest map by areas and routes, or null when there are no maps yet. */
  shapes: { count: number; mapName: string } | null;
  lookups: LookupUsage;
}) {
  const limits = PLAN_LIMITS[plan];

  return (
    // Two across at most: this sits in the settings column, which is a reading
    // measure, and four meters in it would each be too narrow for its note.
    <div className="grid gap-4 sm:grid-cols-2">
      <UsageMeter
        label="Maps"
        icon={MapIcon}
        used={mapCount}
        limit={limits.maps}
        note={
          mapCount >= limits.maps
            ? "You're at the ceiling — a higher plan is the way to another one."
            : "Every map is published separately and embedded on its own."
        }
      />

      <UsageMeter
        label="Locations"
        icon={MapPin}
        used={places?.count ?? 0}
        limit={limits.places}
        note={
          places
            ? `The most on one map, which is ${places.mapName}. The limit is per map, not per account.`
            : "The limit is per map, not per account. You haven't added any locations yet."
        }
      />

      <UsageMeter
        label="Areas and routes"
        icon={Shapes}
        used={shapes?.count ?? 0}
        limit={limits.shapes}
        note={
          shapes
            ? `The most on one map, which is ${shapes.mapName}. Circles, polygons and routes all count.`
            : "Circles, polygons and drawn routes all count, and the limit is per map."
        }
      />

      {/*
       * Stated rather than discovered. This is the only limit in the product a
       * customer can hit without doing anything they would recognise as creating
       * something — a map, a location and a shape are all things you can see and
       * count, and a lookup is not. Leaving it to be announced by a refusal in the
       * middle of an import would be the worst possible first mention of it, which
       * is also why the note says what spends one.
       */}
      <UsageMeter
        label="Address lookups"
        icon={Search}
        used={lookups.used}
        limit={lookups.limit}
        note="One lookup is one address turned into a point — importing a row, dropping a pin, or searching for a place. Resets on the 1st."
      />
    </div>
  );
}
