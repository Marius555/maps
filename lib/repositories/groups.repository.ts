import "server-only";

import { ID, Query } from "node-appwrite";

import { admin } from "@/lib/appwrite/admin";
import { TABLES } from "@/lib/appwrite/config";
import { isNotFound, toRepositoryError } from "@/lib/appwrite/errors";
import { env } from "@/lib/env";
import type {
  CreateGroupInput,
  UpdateGroupInput,
} from "@/lib/validation/group.schema";
import type { RepoContext } from "./context";
import { NotFoundError } from "./errors";
import { toGroup } from "./mappers";
import { getMap, ownerPermissions } from "./maps.repository";
import type { Group, GroupRow, Page } from "./types";

/**
 * Bundles of locations and shapes. The same shape as shapes.repository.ts —
 * the ownership rule and the pagination are that file's, and a second answer to
 * either would be a second thing to get wrong.
 *
 * Two differences, both deliberate:
 *
 * **No plan check.** A group cannot outnumber the places and shapes inside it,
 * and those are limited already. §6's table has no row for groups.
 *
 * **`deleteGroup` leaves its members' `groupId` dangling.** Clearing them would
 * be one write per member inside a request that can half-fail, and there is no
 * bulk-update primitive here — `tablesDB.updateRows` is unused in this codebase;
 * only `createRows`, for the CSV import. So the client treats a `groupId` naming
 * a group that isn't in the list as ungrouped, which needs no cleanup at all and
 * cannot leave a location stranded inside a group that no longer exists.
 */

/** Appwrite's hard ceiling for a single page. */
const MAX_PAGE_SIZE = 100;
/** Belt and braces on listAllGroups: far past anything a person will make. */
const MAX_PAGES = 20;

type ListOptions = {
  cursor?: string | null;
  limit?: number;
};

/** Creation order, for the same determinism reason places and shapes sort this way. */
const ORDER = Query.orderAsc("$createdAt");

export async function listGroups(
  ctx: RepoContext,
  mapId: string,
  options: ListOptions = {},
): Promise<Page<Group>> {
  // Ownership of the map is what authorises everything about its groups.
  await getMap(ctx, mapId);

  const limit = Math.min(options.limit ?? MAX_PAGE_SIZE, MAX_PAGE_SIZE);
  const queries = [Query.equal("mapId", mapId), ORDER, Query.limit(limit)];
  if (options.cursor) queries.push(Query.cursorAfter(options.cursor));

  try {
    const result = await admin.tablesDB.listRows<GroupRow>({
      databaseId: env.databaseId,
      tableId: TABLES.groups,
      queries,
      total: true,
    });

    return {
      items: result.rows.map(toGroup),
      nextCursor: result.rows.length === limit ? result.rows[limit - 1].$id : null,
      total: result.total,
    };
  } catch (error) {
    throw toRepositoryError(error);
  }
}

/**
 * Every group on a map, following cursors internally, so no component ever
 * writes a pagination loop (CLAUDE.md §7).
 */
export async function listAllGroups(
  ctx: RepoContext,
  mapId: string,
): Promise<Group[]> {
  const all: Group[] = [];
  let cursor: string | null = null;

  for (let page = 0; page < MAX_PAGES; page += 1) {
    const result: Page<Group> = await listGroups(ctx, mapId, {
      cursor,
      limit: MAX_PAGE_SIZE,
    });

    all.push(...result.items);
    if (!result.nextCursor) return all;
    cursor = result.nextCursor;
  }

  throw new Error(
    `Map ${mapId} has more than ${MAX_PAGES * MAX_PAGE_SIZE} groups. ` +
      "Refusing to load them all at once.",
  );
}

export async function getGroup(
  ctx: RepoContext,
  mapId: string,
  groupId: string,
): Promise<Group> {
  await getMap(ctx, mapId);

  let row: GroupRow;
  try {
    row = await admin.tablesDB.getRow<GroupRow>({
      databaseId: env.databaseId,
      tableId: TABLES.groups,
      rowId: groupId,
    });
  } catch (error) {
    if (isNotFound(error)) throw new NotFoundError("That group doesn't exist.");
    throw toRepositoryError(error);
  }

  // A group id from another map would otherwise be readable by anyone who owns
  // any map at all.
  if (row.mapId !== mapId) throw new NotFoundError("That group doesn't exist.");

  return toGroup(row);
}

export async function createGroup(
  ctx: RepoContext,
  mapId: string,
  input: CreateGroupInput,
): Promise<Group> {
  await getMap(ctx, mapId);

  try {
    const row = await admin.tablesDB.createRow<GroupRow>({
      databaseId: env.databaseId,
      tableId: TABLES.groups,
      rowId: ID.unique(),
      data: {
        mapId,
        name: input.name,
        color: input.color,
        sortOrder: input.sortOrder,
      },
      permissions: ownerPermissions(ctx.userId),
    });

    return toGroup(row);
  } catch (error) {
    throw toRepositoryError(error);
  }
}

export async function updateGroup(
  ctx: RepoContext,
  mapId: string,
  groupId: string,
  input: UpdateGroupInput,
): Promise<Group> {
  await getGroup(ctx, mapId, groupId);

  try {
    const row = await admin.tablesDB.updateRow<GroupRow>({
      databaseId: env.databaseId,
      tableId: TABLES.groups,
      rowId: groupId,
      data: input,
    });

    return toGroup(row);
  } catch (error) {
    throw toRepositoryError(error);
  }
}

/**
 * Deletes the group and nothing else. Members keep a `groupId` pointing at a row
 * that is gone, which reads as ungrouped — see this file's header for why that
 * is the design rather than an oversight.
 */
export async function deleteGroup(
  ctx: RepoContext,
  mapId: string,
  groupId: string,
): Promise<void> {
  await getGroup(ctx, mapId, groupId);

  try {
    await admin.tablesDB.deleteRow({
      databaseId: env.databaseId,
      tableId: TABLES.groups,
      rowId: groupId,
    });
  } catch (error) {
    throw toRepositoryError(error);
  }
}
