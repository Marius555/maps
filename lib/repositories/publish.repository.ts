import "server-only";

import { admin } from "@/lib/appwrite/admin";
import { TABLES } from "@/lib/appwrite/config";
import { toRepositoryError } from "@/lib/appwrite/errors";
import { env } from "@/lib/env";
import { collectUrl } from "@/lib/analytics/collect-url";
import { publishBadge } from "@/lib/embed/badge";
import { gazetteerBase } from "@/lib/gazetteer/config";
import { buildSnapshot } from "@/lib/snapshot/build";
import { uploadSnapshot } from "@/lib/snapshot/storage";
import { effectiveCardLayout } from "@/lib/card/designer-status";
import { getCardDesign } from "./card-design.repository";
import type { RepoContext } from "./context";
import { PublishOverLimitError } from "./errors";
import { listAllGroups } from "./groups.repository";
import { toAppMap } from "./mappers";
import { getMap, isAmongFirstMaps } from "./maps.repository";
import { PLAN_LIMITS, getUserPlan, planAllows, type PlanId } from "./plan-limits";
import { listAllPlaces } from "./places.repository";
import { listAllShapes } from "./shapes.repository";
import type { AppMap, MapRow } from "./types";

/**
 * Publishing lives in its own module rather than on maps.repository, which
 * already imports places.repository — putting it there would close an import
 * cycle between the two.
 */

export type PublishResult = {
  map: AppMap;
  /** Locations written into the snapshot. */
  publishedCount: number;
  /** Shapes written into the snapshot. */
  publishedShapeCount: number;
  /** Locations left out because their coordinates were unusable. */
  skippedCount: number;
  /**
   * The first few skipped names, so the UI can say which locations rather than
   * only how many. Truncated — a 200-row mess shouldn't produce a 200-item toast.
   */
  skippedNames: string[];
};

/** Named in full in the response; beyond this the UI summarises. */
const MAX_REPORTED_SKIPS = 5;

/**
 * **The confirmed-address gate is not here, and must not be moved here.** It sits
 * in `app/api/maps/[id]/publish/route.ts`, where `withAuth` has a real Appwrite
 * user to read `emailVerified` from. This function's other caller is the nightly
 * sheet sync, which republishes an already-live map from a cron with no session —
 * a check at this level would either break it or make every sync pay for a user
 * lookup. The route's docblock carries the full reasoning.
 */
export async function publishMap(
  ctx: RepoContext,
  mapId: string,
  /**
   * The dashboard's own origin, from the request.
   *
   * Used to resolve the gazetteer base when `NEXT_PUBLIC_GAZETTEER_URL` is
   * unset, and the collector URL when `NEXT_PUBLIC_COLLECT_URL` is — which is
   * what makes development and self-hosting work with no config, the same
   * fallback `embedScriptUrl` uses. Threaded from the route rather than read
   * here, because a repository has no request.
   */
  origin: string,
): Promise<PublishResult> {
  /*
   * Ownership is checked in the same batch as the reads, not ahead of them —
   * nothing below runs, and nothing is generated, unless `getMap` resolved.
   *
   * The plan is the map's owner's rather than the caller's, because the nightly
   * sheet sync republishes with no session — and the badge is the owner's
   * plan's answer. `ctx.userId` *is* the owner here: `getMap` refuses any map
   * whose `userId` differs, which is what lets this read join the batch rather
   * than wait for the map row to name its owner.
   */
  const [map, places, shapes, groups, cardDesign, plan] = await Promise.all([
    getMap(ctx, mapId),
    listAllPlaces(ctx, mapId),
    listAllShapes(ctx, mapId),
    // Only their colours are published, never their ids — see buildSnapshot.
    listAllGroups(ctx, mapId),
    getCardDesign(ctx),
    getUserPlan(ctx.userId),
  ]);

  await assertPublishable(map.userId, mapId, plan, places.length, shapes.length);

  const generatedAt = new Date().toISOString();
  const { snapshot, skipped } = buildSnapshot(
    map,
    places,
    shapes,
    generatedAt,
    gazetteerBase(origin),
    effectiveCardLayout(cardDesign),
    collectUrl(origin),
    groups,
    planAllows(plan, "noBadge") ? undefined : publishBadge(),
  );

  // Storage before the row. If the upload fails the map stays exactly as it was,
  // still pointing at the previous snapshot, and the embed keeps serving it.
  const { liveUrl } = await uploadSnapshot(snapshot);

  try {
    const row = await admin.tablesDB.updateRow<MapRow>({
      databaseId: env.databaseId,
      tableId: TABLES.maps,
      rowId: mapId,
      data: { publishedAt: generatedAt, snapshotUrl: liveUrl },
    });

    return {
      map: toAppMap(row),
      publishedCount: snapshot.places.length,
      publishedShapeCount: snapshot.shapes?.length ?? 0,
      skippedCount: skipped.length,
      skippedNames: skipped.slice(0, MAX_REPORTED_SKIPS).map((place) => place.name),
    };
  } catch (error) {
    throw toRepositoryError(error);
  }
}

/**
 * Refuse to publish a map that holds more than its owner's plan allows.
 *
 * Every create is refused at the limit, so this only ever fires after a
 * downgrade: a Pro account's 400-location map, now on Starter. Without it the
 * limits were only on *making* things — the whole map went on publishing
 * everything it held, which made a downgrade a way to keep the higher plan.
 *
 * Nothing is deleted and the live snapshot is left exactly as it was: the map on
 * the customer's site keeps working, and it is the next publish that waits until
 * the map fits or the plan does. Here rather than in the route because the
 * nightly sheet sync republishes through `publishMap` too, and must meet the
 * same rule.
 */
async function assertPublishable(
  userId: string,
  mapId: string,
  plan: PlanId,
  placeCount: number,
  shapeCount: number,
): Promise<void> {
  const limits = PLAN_LIMITS[plan];

  if (placeCount > limits.places) {
    throw new PublishOverLimitError("places", placeCount, limits.places, plan);
  }

  if (shapeCount > limits.shapes) {
    throw new PublishOverLimitError("shapes", shapeCount, limits.shapes, plan);
  }

  if (!(await isAmongFirstMaps(userId, mapId, limits.maps))) {
    throw new PublishOverLimitError("maps", 0, limits.maps, plan);
  }
}
