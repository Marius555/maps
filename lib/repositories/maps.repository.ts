import "server-only";

import { ID, Permission, Query, Role } from "node-appwrite";

import { admin } from "@/lib/appwrite/admin";
import { TABLES } from "@/lib/appwrite/config";
import { isConflict, isNotFound, toRepositoryError } from "@/lib/appwrite/errors";
import { env } from "@/lib/env";
import { deleteSnapshots } from "@/lib/snapshot/storage";
import { randomSuffix, slugify } from "@/lib/utils/slug";
import { CUSTOM_PIN_PREFIX } from "@/packages/shared/pin-icons";
import type { CreateMapInput, UpdateMapInput } from "@/lib/validation/map.schema";
import type { RepoContext } from "./context";
import { ConflictError, NotFoundError, PlanLimitError } from "./errors";
import { toAppMap } from "./mappers";
import { PLAN_LIMITS, getUserPlan } from "./plan-limits";
import type { AppMap, MapRow } from "./types";

const MAX_MAPS_PER_PAGE = 100;
const SLUG_ATTEMPTS = 3;

/** Row permissions the owner gets on everything they create. */
function ownerPermissions(userId: string): string[] {
  return [
    Permission.read(Role.user(userId)),
    Permission.update(Role.user(userId)),
    Permission.delete(Role.user(userId)),
  ];
}

export async function listMaps(ctx: RepoContext): Promise<AppMap[]> {
  try {
    const result = await admin.tablesDB.listRows<MapRow>({
      databaseId: env.databaseId,
      tableId: TABLES.maps,
      queries: [
        Query.equal("userId", ctx.userId),
        Query.orderDesc("$createdAt"),
        Query.limit(MAX_MAPS_PER_PAGE),
      ],
    });

    return result.rows.map(toAppMap);
  } catch (error) {
    throw toRepositoryError(error);
  }
}

/**
 * A map that exists but belongs to someone else is reported as missing, never as
 * forbidden. A 403 would confirm the id is real; a 404 leaks nothing.
 */
export async function getMap(ctx: RepoContext, mapId: string): Promise<AppMap> {
  let row: MapRow;

  try {
    row = await admin.tablesDB.getRow<MapRow>({
      databaseId: env.databaseId,
      tableId: TABLES.maps,
      rowId: mapId,
    });
  } catch (error) {
    if (isNotFound(error)) throw new NotFoundError("That map doesn't exist.");
    throw toRepositoryError(error);
  }

  if (row.userId !== ctx.userId) throw new NotFoundError("That map doesn't exist.");

  return toAppMap(row);
}

export async function countMaps(ctx: RepoContext): Promise<number> {
  try {
    // One row over the wire; `total` still reports the real count.
    const result = await admin.tablesDB.listRows<MapRow>({
      databaseId: env.databaseId,
      tableId: TABLES.maps,
      queries: [Query.equal("userId", ctx.userId), Query.limit(1)],
      total: true,
    });

    return result.total;
  } catch (error) {
    throw toRepositoryError(error);
  }
}

export async function createMap(
  ctx: RepoContext,
  input: CreateMapInput,
): Promise<AppMap> {
  const plan = await getUserPlan(ctx.userId);
  const limit = PLAN_LIMITS[plan].maps;

  if ((await countMaps(ctx)) >= limit) {
    throw new PlanLimitError("maps", limit, plan);
  }

  const base = slugify(input.name);

  // Slugs are globally unique, so a "is this taken?" pre-check is both a race and
  // a read of other users' rows. Let the unique index decide and retry on 409.
  for (let attempt = 0; attempt < SLUG_ATTEMPTS; attempt += 1) {
    const slug = attempt === 0 ? base : `${base}-${randomSuffix()}`;

    try {
      const row = await admin.tablesDB.createRow<MapRow>({
        databaseId: env.databaseId,
        tableId: TABLES.maps,
        rowId: ID.unique(),
        data: {
          userId: ctx.userId,
          name: input.name,
          slug,
          style: input.style,
          defaultLat: input.defaultLat,
          defaultLng: input.defaultLng,
          defaultZoom: input.defaultZoom,
          categories: "[]",
          pinIcons: "[]",
          settings: "{}",
          appearance: "{}",
          allowedDomains: [],
        },
        permissions: ownerPermissions(ctx.userId),
      });

      return toAppMap(row);
    } catch (error) {
      if (isConflict(error)) continue;
      throw toRepositoryError(error);
    }
  }

  throw new ConflictError("That name is already taken. Try a different one.");
}

export async function updateMap(
  ctx: RepoContext,
  mapId: string,
  input: UpdateMapInput,
): Promise<AppMap> {
  const before = await getMap(ctx, mapId);

  // `categories`, `tagGroups`, `fields`, `pinIcons`, `settings` and
  // `appearance` are JSON text columns, so they have to be serialised.
  // Everything else maps straight onto its column.
  const { categories, tagGroups, fields, pinIcons, settings, appearance, ...rest } =
    input;
  const data: Record<string, unknown> = { ...rest };
  if (categories) data.categories = JSON.stringify(categories);
  if (tagGroups) data.tagGroups = JSON.stringify(tagGroups);
  if (fields) data.fields = JSON.stringify(fields);
  if (pinIcons) data.pinIcons = JSON.stringify(pinIcons);
  if (settings) data.settings = JSON.stringify(settings);
  if (appearance) data.appearance = JSON.stringify(appearance);

  try {
    const row = await admin.tablesDB.updateRow<MapRow>({
      databaseId: env.databaseId,
      tableId: TABLES.maps,
      rowId: mapId,
      data,
    });

    // Places reference a category by id. Dropping a category without clearing
    // those references would leave locations tagged with something the legend
    // can no longer explain.
    if (categories) {
      const removed = before.categories
        .map((category) => category.id)
        .filter((id) => !categories.some((category) => category.id === id));

      await clearFromPlaces(mapId, "category", removed);
    }

    /*
     * The same for pins, though the failure it prevents is quieter: a place
     * naming a deleted pin already renders as a plain one, because resolvePin
     * returns null for it. Clearing it anyway keeps the stored data saying what
     * the map shows, and stops a later pin that happened to reuse the id from
     * resurrecting itself onto locations nobody assigned it to.
     */
    if (pinIcons) {
      const removed = before.pinIcons
        .map((icon) => `${CUSTOM_PIN_PREFIX}${icon.id}`)
        .filter(
          (id) =>
            !pinIcons.some((icon) => `${CUSTOM_PIN_PREFIX}${icon.id}` === id),
        );

      await clearFromPlaces(mapId, "icon", removed);
    }

    /*
     * Tags and custom fields get no such sweep, deliberately.
     *
     * `clearFromPlaces` sets a scalar column to "" where it equals a value, and
     * neither of these is scalar: `tags` is an array column Appwrite cannot
     * remove a single element from, and `fields` is a JSON object. Clearing
     * either means reading every place that references the deleted id and
     * rewriting it — a read plus N updates on a map §6 allows 3,000 locations in.
     *
     * It also buys nothing a visitor can see: `buildSnapshot` narrows both to
     * what the map still defines, so a dangling id is already invisible off the
     * dashboard. This is the same call `groupId` already makes. What makes it
     * safe is that tag and field ids are minted fresh and never reused, so a
     * deleted id cannot come back attached to a new tag (lib/validation/tag.schema.ts).
     */

    return toAppMap(row);
  } catch (error) {
    throw toRepositoryError(error);
  }
}

/**
 * One bulk update per removed value. Appwrite has no "set to '' where in (...)"
 * so this is a small loop, and deleting several categories or pins at once is
 * rare enough not to optimise.
 */
async function clearFromPlaces(
  mapId: string,
  column: "category" | "icon",
  values: string[],
): Promise<void> {
  for (const value of values) {
    await admin.tablesDB.updateRows({
      databaseId: env.databaseId,
      tableId: TABLES.places,
      data: { [column]: "" },
      queries: [Query.equal("mapId", mapId), Query.equal(column, value)],
    });
  }
}

export async function deleteMap(ctx: RepoContext, mapId: string): Promise<void> {
  await getMap(ctx, mapId);

  try {
    // Snapshots first. They are world-readable by design, so a deleted map that
    // kept its live snapshot would carry on serving the customer's locations to
    // anyone holding the URL.
    await deleteSnapshots(mapId);

    // Places and shapes next: a map row deleted before its children would orphan
    // them with no owner left to find them by.
    for (const tableId of [TABLES.places, TABLES.shapes]) {
      await admin.tablesDB.deleteRows({
        databaseId: env.databaseId,
        tableId,
        queries: [Query.equal("mapId", mapId)],
      });
    }

    await admin.tablesDB.deleteRow({
      databaseId: env.databaseId,
      tableId: TABLES.maps,
      rowId: mapId,
    });
  } catch (error) {
    throw toRepositoryError(error);
  }
}

export { ownerPermissions };
