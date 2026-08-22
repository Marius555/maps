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
 * **`deleteGroup` leaves its members' `groupId` dangling.** Not for want of a
 * bulk primitive — `setGroupPin` below writes every member in one request, and
 * `clearFromPlaces` in maps.repository.ts has done the same for categories and
 * pins for a while. It stays this way because it is the better answer: a client
 * that treats a `groupId` naming a group not in the list as ungrouped needs no
 * cleanup at all, and cannot leave a location stranded inside a group that no
 * longer exists even if the write half-fails.
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
 * Gives every location in a group the same pin.
 *
 * One request whatever the group holds, rather than the one-PATCH-per-member
 * shape `useAssignToGroup` uses for membership. That shape is right there: a
 * marquee is bounded by what fits in a drag box. This is not — §6 allows 3,000
 * locations on a map and every one of them can be in one group, and firing three
 * thousand PATCHes from a browser to change a pin is not a thing to build.
 *
 * `getGroup` first, because that is the whole authorisation: it resolves the map
 * through `getMap` and rejects a group id belonging to someone else's map. The
 * `mapId` is repeated in the query anyway — a `groupId` is only ever scoped by
 * the map it was found in, and a query on `groupId` alone would be one bug away
 * from repainting another customer's pins.
 *
 * Shapes are untouched. A shape carries a colour and a geometry, not a pin.
 */
export async function setGroupPin(
  ctx: RepoContext,
  mapId: string,
  groupId: string,
  icon: string,
): Promise<number> {
  await getGroup(ctx, mapId, groupId);

  try {
    const result = await admin.tablesDB.updateRows({
      databaseId: env.databaseId,
      tableId: TABLES.places,
      data: { icon },
      queries: [Query.equal("mapId", mapId), Query.equal("groupId", groupId)],
    });

    return result.total;
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

/**
 * Deletes the group *and* everything in it.
 *
 * The sibling of `deleteGroup`, and its opposite: that one takes the bundle
 * apart and keeps the contents, this one keeps nothing. Both exist because the
 * two are genuinely different intentions, and a single control that guessed
 * which one you meant would guess wrong half the time on an irreversible action.
 *
 * Places and shapes both. A group holds both kinds — that is the point of it —
 * so a delete that emptied half of one would leave a group the user believed was
 * gone still drawing regions on their map. `setGroupPin` above touches only
 * places, and that is not an inconsistency: a shape has no pin to change, but it
 * very much can be deleted.
 *
 * Scoped by `mapId` **and** `groupId`, like `setGroupPin` and for the reason it
 * gives — an id is only meaningful inside the map it was found in, and a bulk
 * delete keyed on `groupId` alone is one bug away from emptying somebody else's
 * map. `getGroup` first is the whole authorisation: it resolves the map through
 * `getMap` and rejects a group belonging to another account.
 *
 * Contents before the group, the order `deleteMap` uses: the group row deleted
 * first would leave its members pointing at nothing, which reads as *ungrouped*
 * — so a failure half-way would scatter them across the map instead of leaving a
 * group still holding whatever survived.
 *
 * Photos are not deleted, matching `deletePlace` and `deleteMap`. That is a
 * pre-existing leak across every delete path in the app rather than a decision
 * taken here; fixing it in one of them would be the inconsistency.
 */
export async function deleteGroupContents(
  ctx: RepoContext,
  mapId: string,
  groupId: string,
): Promise<{ places: number; shapes: number }> {
  await getGroup(ctx, mapId, groupId);

  const scope = [Query.equal("mapId", mapId), Query.equal("groupId", groupId)];

  try {
    // Sequential rather than a Promise.all: two bulk deletes against the same
    // account fired together buy nothing worth the risk of one landing while the
    // other is rejected for rate.
    const places = await admin.tablesDB.deleteRows({
      databaseId: env.databaseId,
      tableId: TABLES.places,
      queries: scope,
    });

    const shapes = await admin.tablesDB.deleteRows({
      databaseId: env.databaseId,
      tableId: TABLES.shapes,
      queries: scope,
    });

    await admin.tablesDB.deleteRow({
      databaseId: env.databaseId,
      tableId: TABLES.groups,
      rowId: groupId,
    });

    return { places: places.total, shapes: shapes.total };
  } catch (error) {
    throw toRepositoryError(error);
  }
}
