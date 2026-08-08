import "server-only";

import { ID, Query } from "node-appwrite";

import { admin } from "@/lib/appwrite/admin";
import { TABLES } from "@/lib/appwrite/config";
import { isNotFound, toRepositoryError } from "@/lib/appwrite/errors";
import { env } from "@/lib/env";
import type {
  CreatePlaceInput,
  UpdatePlaceInput,
} from "@/lib/validation/place.schema";
import type { RepoContext } from "./context";
import { NotFoundError, PlanLimitError } from "./errors";
import { toPlace } from "./mappers";
import { getMap, ownerPermissions } from "./maps.repository";
import { PLAN_LIMITS, getUserPlan } from "./plan-limits";
import type { Page, Place, PlaceRow } from "./types";

/** Appwrite's hard ceiling for a single page. */
const MAX_PAGE_SIZE = 100;
/** Belt and braces on listAllPlaces: 50 pages is far past any plan's limit. */
const MAX_PAGES = 50;
/** Rows per createRows call. Keeps any single bulk request modest. */
const BULK_CHUNK_SIZE = 50;

type ListOptions = {
  cursor?: string | null;
  limit?: number;
};

/**
 * Order by creation, not by sortOrder. Every row starts at sortOrder 0, which
 * would make cursor paging non-deterministic. Week 2's drag-to-reorder writes
 * real values and takes over as the primary sort, with $createdAt as tiebreaker.
 */
const ORDER = Query.orderAsc("$createdAt");

export async function listPlaces(
  ctx: RepoContext,
  mapId: string,
  options: ListOptions = {},
): Promise<Page<Place>> {
  // Ownership of the map is what authorises everything about its places.
  await getMap(ctx, mapId);

  const limit = Math.min(options.limit ?? MAX_PAGE_SIZE, MAX_PAGE_SIZE);
  const queries = [Query.equal("mapId", mapId), ORDER, Query.limit(limit)];
  if (options.cursor) queries.push(Query.cursorAfter(options.cursor));

  try {
    const result = await admin.tablesDB.listRows<PlaceRow>({
      databaseId: env.databaseId,
      tableId: TABLES.places,
      queries,
      total: true,
    });

    const items = result.rows.map(toPlace);

    return {
      items,
      nextCursor: result.rows.length === limit ? result.rows[limit - 1].$id : null,
      total: result.total,
    };
  } catch (error) {
    throw toRepositoryError(error);
  }
}

/**
 * Every place on a map, following cursors internally.
 *
 * This exists so no component ever writes a pagination loop (CLAUDE.md §7).
 * The canvas needs all markers, and 500 places is 5 requests, not 20.
 */
export async function listAllPlaces(
  ctx: RepoContext,
  mapId: string,
): Promise<Place[]> {
  const all: Place[] = [];
  let cursor: string | null = null;

  for (let page = 0; page < MAX_PAGES; page += 1) {
    const result: Page<Place> = await listPlaces(ctx, mapId, {
      cursor,
      limit: MAX_PAGE_SIZE,
    });

    all.push(...result.items);
    if (!result.nextCursor) return all;
    cursor = result.nextCursor;
  }

  throw new Error(
    `Map ${mapId} has more than ${MAX_PAGES * MAX_PAGE_SIZE} locations. ` +
      "Refusing to load them all at once.",
  );
}

export async function getPlace(
  ctx: RepoContext,
  mapId: string,
  placeId: string,
): Promise<Place> {
  await getMap(ctx, mapId);

  let row: PlaceRow;
  try {
    row = await admin.tablesDB.getRow<PlaceRow>({
      databaseId: env.databaseId,
      tableId: TABLES.places,
      rowId: placeId,
    });
  } catch (error) {
    if (isNotFound(error)) throw new NotFoundError("That location doesn't exist.");
    throw toRepositoryError(error);
  }

  // A place id from another map would otherwise be readable by anyone who owns
  // any map at all.
  if (row.mapId !== mapId) throw new NotFoundError("That location doesn't exist.");

  return toPlace(row);
}

export async function countPlaces(
  ctx: RepoContext,
  mapId: string,
): Promise<number> {
  await getMap(ctx, mapId);

  try {
    const result = await admin.tablesDB.listRows<PlaceRow>({
      databaseId: env.databaseId,
      tableId: TABLES.places,
      queries: [Query.equal("mapId", mapId), Query.limit(1)],
      total: true,
    });

    return result.total;
  } catch (error) {
    throw toRepositoryError(error);
  }
}

export async function createPlace(
  ctx: RepoContext,
  mapId: string,
  input: CreatePlaceInput,
): Promise<Place> {
  await getMap(ctx, mapId);

  const plan = await getUserPlan(ctx.userId);
  const limit = PLAN_LIMITS[plan].places;

  if ((await countPlaces(ctx, mapId)) >= limit) {
    throw new PlanLimitError("places", limit, plan);
  }

  try {
    const row = await admin.tablesDB.createRow<PlaceRow>({
      databaseId: env.databaseId,
      tableId: TABLES.places,
      rowId: ID.unique(),
      data: {
        mapId,
        name: input.name,
        lat: input.lat,
        lng: input.lng,
        address: input.address,
        category: input.category,
        description: input.description ?? null,
        phone: input.phone ?? null,
        email: input.email ?? null,
        url: input.url ?? null,
        sortOrder: input.sortOrder,
        geocodeStatus: input.geocodeStatus,
      },
      permissions: ownerPermissions(ctx.userId),
    });

    return toPlace(row);
  } catch (error) {
    throw toRepositoryError(error);
  }
}

/**
 * Bulk insert, for a confirmed CSV import.
 *
 * The plan check counts the batch as a whole rather than per row: 8 free-plan
 * slots left and a 40-row import is one refusal up front, not 8 saved rows and a
 * confusing failure partway down the file.
 */
export async function createPlaces(
  ctx: RepoContext,
  mapId: string,
  inputs: CreatePlaceInput[],
): Promise<Place[]> {
  await getMap(ctx, mapId);
  if (inputs.length === 0) return [];

  const plan = await getUserPlan(ctx.userId);
  const limit = PLAN_LIMITS[plan].places;
  const existing = await countPlaces(ctx, mapId);

  if (existing + inputs.length > limit) {
    throw new PlanLimitError("places", limit, plan);
  }

  const permissions = ownerPermissions(ctx.userId);
  const created: Place[] = [];

  try {
    // Chunked: one enormous createRows is a single point of failure, and a
    // partial import that reports how far it got beats an opaque timeout.
    for (let start = 0; start < inputs.length; start += BULK_CHUNK_SIZE) {
      const chunk = inputs.slice(start, start + BULK_CHUNK_SIZE);

      const result = await admin.tablesDB.createRows<PlaceRow>({
        databaseId: env.databaseId,
        tableId: TABLES.places,
        rows: chunk.map((input, offset) => ({
          // Bulk create takes per-row $id and $permissions inline; without them
          // the rows would land with no owner.
          $id: ID.unique(),
          $permissions: permissions,
          mapId,
          name: input.name,
          lat: input.lat,
          lng: input.lng,
          address: input.address,
          category: input.category,
          description: input.description ?? null,
          phone: input.phone ?? null,
          email: input.email ?? null,
          url: input.url ?? null,
          sortOrder: existing + start + offset,
          geocodeStatus: input.geocodeStatus,
        })),
      });

      created.push(...result.rows.map(toPlace));
    }

    return created;
  } catch (error) {
    throw toRepositoryError(error);
  }
}

export async function updatePlace(
  ctx: RepoContext,
  mapId: string,
  placeId: string,
  input: UpdatePlaceInput,
): Promise<Place> {
  await getPlace(ctx, mapId, placeId);

  try {
    const row = await admin.tablesDB.updateRow<PlaceRow>({
      databaseId: env.databaseId,
      tableId: TABLES.places,
      rowId: placeId,
      data: input,
    });

    return toPlace(row);
  } catch (error) {
    throw toRepositoryError(error);
  }
}

export async function deletePlace(
  ctx: RepoContext,
  mapId: string,
  placeId: string,
): Promise<void> {
  await getPlace(ctx, mapId, placeId);

  try {
    await admin.tablesDB.deleteRow({
      databaseId: env.databaseId,
      tableId: TABLES.places,
      rowId: placeId,
    });
  } catch (error) {
    throw toRepositoryError(error);
  }
}
