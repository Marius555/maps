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
import type { ShapeGeometry } from "@/packages/shared/shapes";
import type { RepoContext } from "./context";
import { NotFoundError, PlanLimitError } from "./errors";
import { toShape } from "./mappers";
import { getMap, ownerPermissions } from "./maps.repository";
import { PLAN_LIMITS, getUserPlan } from "./plan-limits";
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

type ListOptions = {
  cursor?: string | null;
  limit?: number;
};

/** Creation order, for the same determinism reason places sort this way. */
const ORDER = Query.orderAsc("$createdAt");

/**
 * The `kind` column and the geometry payload, split out of the domain union.
 *
 * The union carries `kind` because both renderers switch on it; the row keeps it
 * in its own column so a query could filter on it one day. Splitting here rather
 * than storing the union whole is what stops the two copies disagreeing.
 */
function toColumns(geometry: ShapeGeometry): { kind: string; geometry: string } {
  if (geometry.kind === "circle") {
    const { lng, lat, radius } = geometry;
    return { kind: "circle", geometry: JSON.stringify({ lng, lat, radius }) };
  }

  return {
    kind: "polygon",
    geometry: JSON.stringify({ points: geometry.points }),
  };
}

export async function listShapes(
  ctx: RepoContext,
  mapId: string,
  options: ListOptions = {},
): Promise<Page<Shape>> {
  // Ownership of the map is what authorises everything about its shapes.
  await getMap(ctx, mapId);

  const limit = Math.min(options.limit ?? MAX_PAGE_SIZE, MAX_PAGE_SIZE);
  const queries = [Query.equal("mapId", mapId), ORDER, Query.limit(limit)];
  if (options.cursor) queries.push(Query.cursorAfter(options.cursor));

  try {
    const result = await admin.tablesDB.listRows<ShapeRow>({
      databaseId: env.databaseId,
      tableId: TABLES.shapes,
      queries,
      total: true,
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
  const all: Shape[] = [];
  let cursor: string | null = null;

  for (let page = 0; page < MAX_PAGES; page += 1) {
    const result: Page<Shape> = await listShapes(ctx, mapId, {
      cursor,
      limit: MAX_PAGE_SIZE,
    });

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

  try {
    const row = await admin.tablesDB.createRow<ShapeRow>({
      databaseId: env.databaseId,
      tableId: TABLES.shapes,
      rowId: ID.unique(),
      data: {
        mapId,
        name: input.name,
        description: input.description ?? null,
        color: input.color,
        opacity: input.opacity,
        sortOrder: input.sortOrder,
        groupId: input.groupId ?? "",
        ...toColumns(input.geometry),
      },
      permissions: ownerPermissions(ctx.userId),
    });

    return toShape(row);
  } catch (error) {
    throw toRepositoryError(error);
  }
}

export async function updateShape(
  ctx: RepoContext,
  mapId: string,
  shapeId: string,
  input: UpdateShapeInput,
): Promise<Shape> {
  await getShape(ctx, mapId, shapeId);

  /*
   * Geometry is the one field whose domain shape is not its column shape — one
   * union here, a discriminator column plus a JSON payload in Appwrite. Spread
   * the rest through untouched so a PATCH carrying only a name still writes only
   * a name, which is what a rename during a drag depends on.
   */
  const { geometry, ...rest } = input;
  const data = { ...rest, ...(geometry === undefined ? {} : toColumns(geometry)) };

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
