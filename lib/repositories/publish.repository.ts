import "server-only";

import { admin } from "@/lib/appwrite/admin";
import { TABLES } from "@/lib/appwrite/config";
import { toRepositoryError } from "@/lib/appwrite/errors";
import { env } from "@/lib/env";
import { gazetteerBase } from "@/lib/gazetteer/config";
import { buildSnapshot } from "@/lib/snapshot/build";
import { uploadSnapshot } from "@/lib/snapshot/storage";
import type { RepoContext } from "./context";
import { toAppMap } from "./mappers";
import { getMap } from "./maps.repository";
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

export async function publishMap(
  ctx: RepoContext,
  mapId: string,
  /**
   * The dashboard's own origin, from the request.
   *
   * Only used to resolve the gazetteer base when `NEXT_PUBLIC_GAZETTEER_URL` is
   * unset, which is what makes development and self-hosting work with no config
   * — the same fallback `embedScriptUrl` uses. Threaded from the route rather
   * than read here, because a repository has no request.
   */
  origin: string,
): Promise<PublishResult> {
  // Ownership first — nothing is generated for a map the caller can't publish.
  const map = await getMap(ctx, mapId);
  const [places, shapes] = await Promise.all([
    listAllPlaces(ctx, mapId),
    listAllShapes(ctx, mapId),
  ]);

  const generatedAt = new Date().toISOString();
  const { snapshot, skipped } = buildSnapshot(
    map,
    places,
    shapes,
    generatedAt,
    gazetteerBase(origin),
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
