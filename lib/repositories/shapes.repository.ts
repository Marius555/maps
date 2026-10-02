import "server-only";

import { ID, Query } from "node-appwrite";

import { admin } from "@/lib/appwrite/admin";
import { TABLES } from "@/lib/appwrite/config";
import { isNotFound, toRepositoryError } from "@/lib/appwrite/errors";
import { env } from "@/lib/env";
import type {
  CreateShapeInput,
  UpdateShapeInput,
} from "@/lib/validation/shape.schema";
import type { RepoContext } from "./context";
import { NotFoundError, PlanFeatureError, PlanLimitError } from "./errors";
import { toShape } from "./mappers";
import { toShapeColumns } from "./shape-geometry";
import { getMap, ownerPermissions } from "./maps.repository";
import {
  PLAN_LIMITS,
  getUserPlan,
  planAllows,
  rollBackIfOverLimit,
  type PlanId,
} from "./plan-limits";
import type { Page, Shape, ShapeRow } from "./types";

/**
 * Areas on a map. The same shape as places.repository.ts, deliberately — the
 * ownership rule, the pagination and the plan check are the ones that file works
 * out, and a second answer to any of them would be a second thing to get wrong.
 */

/** Appwrite's hard ceiling for a single page. */
const MAX_PAGE_SIZE = 100;
/** Belt and braces on listAllShapes: far past any plan's limit. */
const MAX_PAGES = 20;

/** Rows per bulk insert. The same figure createPlaces settled on. */
const BULK_CHUNK_SIZE = 50;

type ListOptions = {
  cursor?: string | null;
  limit?: number;
};

/** Creation order, for the same determinism reason places sort this way. */
const ORDER = Query.orderAsc("$createdAt");

export async function listShapes(
  ctx: RepoContext,
  mapId: string,
  options: ListOptions = {},
): Promise<Page<Shape>> {
  // Ownership of the map is what authorises everything about its shapes.
  await getMap(ctx, mapId);

  return readShapesPage(mapId, options, true);
}

/**
 * One page of rows with no ownership check, so `listAllShapes` checks the map
 * once rather than before every page — see `readPlacesPage`.
 */
async function readShapesPage(
  mapId: string,
  options: ListOptions,
  total: boolean,
): Promise<Page<Shape>> {
  const limit = Math.min(options.limit ?? MAX_PAGE_SIZE, MAX_PAGE_SIZE);
  const queries = [Query.equal("mapId", mapId), ORDER, Query.limit(limit)];
  if (options.cursor) queries.push(Query.cursorAfter(options.cursor));

  try {
    const result = await admin.tablesDB.listRows<ShapeRow>({
      databaseId: env.databaseId,
      tableId: TABLES.shapes,
      queries,
      total,
    });

    return {
      items: result.rows.map(toShape),
      nextCursor: result.rows.length === limit ? result.rows[limit - 1].$id : null,
      total: result.total,
    };
  } catch (error) {
    throw toRepositoryError(error);
  }
}

/**
 * Every shape on a map, following cursors internally, so no component ever
 * writes a pagination loop (CLAUDE.md §7).
 */
export async function listAllShapes(
  ctx: RepoContext,
  mapId: string,
): Promise<Shape[]> {
  // Beside the rows rather than ahead of them: nothing is returned unless the
  // map is the caller's, and a check in series cost every map page one more
  // round trip to Appwrite before its first row was even asked for.
  const [, rows] = await Promise.all([getMap(ctx, mapId), readAllShapes(mapId)]);

  return rows;
}

/** Every page of a map's shapes, with no ownership check — the caller has made it. */
async function readAllShapes(mapId: string): Promise<Shape[]> {
  const all: Shape[] = [];
  let cursor: string | null = null;

  for (let page = 0; page < MAX_PAGES; page += 1) {
    const result: Page<Shape> = await readShapesPage(
      mapId,
      { cursor, limit: MAX_PAGE_SIZE },
      false,
    );

    all.push(...result.items);
    if (!result.nextCursor) return all;
    cursor = result.nextCursor;
  }

  throw new Error(
    `Map ${mapId} has more than ${MAX_PAGES * MAX_PAGE_SIZE} shapes. ` +
      "Refusing to load them all at once.",
  );
}

export async function getShape(
  ctx: RepoContext,
  mapId: string,
  shapeId: string,
): Promise<Shape> {
  await getMap(ctx, mapId);

  let row: ShapeRow;
  try {
    row = await admin.tablesDB.getRow<ShapeRow>({
      databaseId: env.databaseId,
      tableId: TABLES.shapes,
      rowId: shapeId,
    });
  } catch (error) {
    if (isNotFound(error)) throw new NotFoundError("That shape doesn't exist.");
    throw toRepositoryError(error);
  }

  // A shape id from another map would otherwise be readable by anyone who owns
  // any map at all.
  if (row.mapId !== mapId) throw new NotFoundError("That shape doesn't exist.");

  return toShape(row);
}

export async function countShapes(
  ctx: RepoContext,
  mapId: string,
): Promise<number> {
  await getMap(ctx, mapId);

  try {
    const result = await admin.tablesDB.listRows<ShapeRow>({
      databaseId: env.databaseId,
      tableId: TABLES.shapes,
      queries: [Query.equal("mapId", mapId), Query.limit(1)],
      total: true,
    });

    return result.total;
  } catch (error) {
    throw toRepositoryError(error);
  }
}

export async function createShape(
  ctx: RepoContext,
  mapId: string,
  input: CreateShapeInput,
): Promise<Shape> {
  await getMap(ctx, mapId);

  const plan = await getUserPlan(ctx.userId);
  const limit = PLAN_LIMITS[plan].shapes;

  if ((await countShapes(ctx, mapId)) >= limit) {
    throw new PlanLimitError("shapes", limit, plan);
  }

  assertRoutesAllowed(plan, [input.geometry]);

  let created: ShapeRow;

  try {
    created = await admin.tablesDB.createRow<ShapeRow>({
      databaseId: env.databaseId,
      tableId: TABLES.shapes,
      rowId: ID.unique(),
      data: {
        mapId,
        name: input.name,
        description: input.description ?? null,
        color: input.color,
        opacity: input.opacity,
        // 0 and "solid" are the columns' own "nobody has chosen one" — see
        // strokeWidthOf. Nothing picks either at the moment a shape is drawn.
        strokeWidth: input.strokeWidth ?? 0,
        strokeStyle: input.strokeStyle ?? "solid",
        sortOrder: input.sortOrder,
        groupId: input.groupId ?? "",
        ...toShapeColumns(input.geometry),
      },
      permissions: ownerPermissions(ctx.userId),
    });
  } catch (error) {
    throw toRepositoryError(error);
  }

  await rollBackIfOverLimit({
    total: () => countShapes(ctx, mapId),
    limit,
    undo: () => deleteShapesById(mapId, [created.$id]),
    error: new PlanLimitError("shapes", limit, plan),
  });

  return toShape(created);
}

/**
 * Many shapes at once — what importing a GeoJSON file confirms into.
 *
 * The plan check runs **once**, against the whole batch, which is the entire
 * reason this exists beside `createShape`. Looping that function would re-count
 * the table per row and then let a thirteen-province import stop at the third
 * with three provinces already saved and no way to tell which. Refusing the batch
 * whole tells the user something they can act on (§8), and leaves the map as it
 * was.
 *
 * `sortOrder` continues from the map's existing count, so imported shapes land
 * after what is already there in the order the file listed them.
 */
export async function createShapes(
  ctx: RepoContext,
  mapId: string,
  inputs: CreateShapeInput[],
): Promise<Shape[]> {
  await getMap(ctx, mapId);
  if (inputs.length === 0) return [];

  const plan = await getUserPlan(ctx.userId);
  const limit = PLAN_LIMITS[plan].shapes;
  const existing = await countShapes(ctx, mapId);

  if (existing + inputs.length > limit) {
    throw new PlanLimitError("shapes", limit, plan);
  }

  assertRoutesAllowed(
    plan,
    inputs.map((input) => input.geometry),
  );

  const permissions = ownerPermissions(ctx.userId);
  const created: Shape[] = [];

  try {
    // Chunked for the reason createPlaces is: one enormous createRows is a
    // single point of failure, and a partial import that reports how far it got
    // beats an opaque timeout.
    for (let start = 0; start < inputs.length; start += BULK_CHUNK_SIZE) {
      const chunk = inputs.slice(start, start + BULK_CHUNK_SIZE);

      const result = await admin.tablesDB.createRows<ShapeRow>({
        databaseId: env.databaseId,
        tableId: TABLES.shapes,
        rows: chunk.map((input, offset) => ({
          // Bulk create takes per-row $id and $permissions inline. The
          // permissions are empty on purpose — see `ownerPermissions`.
          $id: ID.unique(),
          $permissions: permissions,
          mapId,
          name: input.name,
          description: input.description ?? null,
          color: input.color,
          opacity: input.opacity,
          strokeWidth: input.strokeWidth ?? 0,
          strokeStyle: input.strokeStyle ?? "solid",
          sortOrder: existing + start + offset,
          groupId: input.groupId ?? "",
          ...toShapeColumns(input.geometry),
        })),
      });

      created.push(...result.rows.map(toShape));
    }
  } catch (error) {
    throw toRepositoryError(error);
  }

  await rollBackIfOverLimit({
    total: () => countShapes(ctx, mapId),
    limit,
    undo: () => deleteShapesById(mapId, created.map((shape) => shape.id)),
    error: new PlanLimitError("shapes", limit, plan),
  });

  return created;
}

export async function updateShape(
  ctx: RepoContext,
  mapId: string,
  shapeId: string,
  input: UpdateShapeInput,
): Promise<Shape> {
  await getShape(ctx, mapId, shapeId);

  if (input.geometry) assertRoutesAllowed(await getUserPlan(ctx.userId), [input.geometry]);

  /*
   * Geometry is the one field whose domain shape is not its column shape — one
   * union here, a discriminator column plus a JSON payload in Appwrite. Spread
   * the rest through untouched so a PATCH carrying only a name still writes only
   * a name, which is what a rename during a drag depends on.
   */
  const { geometry, ...rest } = input;
  const data = { ...rest, ...(geometry === undefined ? {} : toShapeColumns(geometry)) };

  try {
    const row = await admin.tablesDB.updateRow<ShapeRow>({
      databaseId: env.databaseId,
      tableId: TABLES.shapes,
      rowId: shapeId,
      data,
    });

    return toShape(row);
  } catch (error) {
    throw toRepositoryError(error);
  }
}

export async function deleteShape(
  ctx: RepoContext,
  mapId: string,
  shapeId: string,
): Promise<void> {
  await getShape(ctx, mapId, shapeId);

  try {
    await admin.tablesDB.deleteRow({
      databaseId: env.databaseId,
      tableId: TABLES.shapes,
      rowId: shapeId,
    });
  } catch (error) {
    throw toRepositoryError(error);
  }
}

/**
 * Refuse a route on a plan without routes.
 *
 * The routing engine's two endpoints already check the plan, but a route is
 * saved as an ordinary line shape carrying a `route` field — so without this a
 * free account could post a route with points it computed itself and publish it.
 * A plain line (no `route`) is allowed on every plan, which is also how a
 * downgraded account keeps editing: renaming or recolouring sends no geometry,
 * and converting a route back to a line drops the field.
 */
function assertRoutesAllowed(
  plan: PlanId,
  geometries: readonly CreateShapeInput["geometry"][],
): void {
  const hasRoute = geometries.some(
    (geometry) => geometry.kind === "line" && geometry.route !== undefined,
  );

  if (hasRoute && !planAllows(plan, "routes")) {
    throw new PlanFeatureError("routes", plan);
  }
}

/** Remove rows this module just created. Scoped by `mapId` as well as by id. */
async function deleteShapesById(mapId: string, shapeIds: readonly string[]): Promise<void> {
  for (let start = 0; start < shapeIds.length; start += MAX_PAGE_SIZE) {
    await admin.tablesDB.deleteRows({
      databaseId: env.databaseId,
      tableId: TABLES.shapes,
      queries: [
        Query.equal("mapId", mapId),
        Query.equal("$id", shapeIds.slice(start, start + MAX_PAGE_SIZE)),
      ],
    });
  }
}
