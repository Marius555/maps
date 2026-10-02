import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * A "list all" read checks the map once, not once per page.
 *
 * Every page used to go through the public `listX`, which re-read the map row
 * to authorise itself and asked Appwrite to count the whole table — so a
 * 3,000-location map was thirty map reads and thirty counts in series ahead of
 * its rows, on every navigation that drew the editor. Nothing errors when that
 * comes back; pages just get slower in proportion to the map, which is the kind
 * of regression nobody notices until a customer does.
 */

vi.mock("@/lib/env", () => ({
  env: { appwriteApiKey: "test-key", databaseId: "test-db", storageId: "test-store" },
}));

vi.mock("@/lib/snapshot/storage", () => ({ deleteSnapshots: vi.fn() }));

const getRow = vi.fn();
const listRows = vi.fn();

vi.mock("@/lib/appwrite/admin", () => ({
  admin: {
    tablesDB: {
      getRow: (...args: unknown[]) => getRow(...args),
      listRows: (...args: unknown[]) => listRows(...args),
    },
  },
}));

vi.mock("./mappers", () => ({
  toAppMap: (row: { $id: string }) => ({ id: row.$id }),
  toPlace: (row: { $id: string }) => ({ id: row.$id }),
  toShape: (row: { $id: string }) => ({ id: row.$id }),
  toGroup: (row: { $id: string }) => ({ id: row.$id }),
}));

import { NotFoundError } from "./errors";
import { listAllGroups } from "./groups.repository";
import { listAllPlaces, listPlaces } from "./places.repository";
import { listAllShapes } from "./shapes.repository";

const ctx = { userId: "owner" };
const MAP_ID = "map-1";

/** One serialised query of `method` from a listRows call, parsed. */
function queryOf(args: { queries: string[] }, method: string): unknown[] | undefined {
  for (const raw of args.queries) {
    const query = JSON.parse(raw) as { method: string; values: unknown[] };
    if (query.method === method) return query.values;
  }
  return undefined;
}

/**
 * `count` rows, served in Appwrite's 100-row pages by cursor or by offset,
 * the way Appwrite would: a count only when asked for, and `0` otherwise.
 */
function servePages(count: number) {
  const ids = Array.from({ length: count }, (_, i) => `row-${i}`);

  listRows.mockImplementation(async (args: { queries: string[]; total: boolean }) => {
    const limit = Number(queryOf(args, "limit")?.[0] ?? 25);
    const cursor = queryOf(args, "cursorAfter")?.[0];
    const offset = Number(queryOf(args, "offset")?.[0] ?? 0);
    const start = cursor ? ids.indexOf(String(cursor)) + 1 : offset;
    const rows = ids.slice(start, start + limit).map(($id) => ({ $id }));

    return { rows, total: args.total ? count : 0 };
  });
}

beforeEach(() => {
  getRow.mockReset();
  listRows.mockReset();
  getRow.mockResolvedValue({ $id: MAP_ID, userId: "owner" });
});

describe.each([
  ["listAllPlaces", listAllPlaces],
  ["listAllShapes", listAllShapes],
  ["listAllGroups", listAllGroups],
])("%s", (_name, listAll) => {
  it("reads the map once for every page of rows", async () => {
    servePages(250);

    const items = await listAll(ctx, MAP_ID);

    expect(items).toHaveLength(250);
    expect(getRow).toHaveBeenCalledTimes(1);
    expect(listRows).toHaveBeenCalledTimes(3);
  });

  it("asks Appwrite to count at most once, however many pages", async () => {
    servePages(350);

    await listAll(ctx, MAP_ID);

    const counted = listRows.mock.calls.filter(([args]) => args.total === true);
    expect(counted.length).toBeLessThanOrEqual(1);
  });

  it("still refuses a map owned by somebody else, and returns none of its rows", async () => {
    servePages(150);
    getRow.mockResolvedValue({ $id: MAP_ID, userId: "someone-else" });

    // The rows may be asked for beside the check, but the read only ever
    // resolves to an error: nothing about another account's map gets out.
    await expect(listAll(ctx, MAP_ID)).rejects.toBeInstanceOf(NotFoundError);
  });
});

describe("listAllPlaces' parallel pages", () => {
  it("reads every page after the first by offset, in order", async () => {
    servePages(1234);

    const places = await listAllPlaces(ctx, MAP_ID);

    expect(places.map((place) => place.id)).toEqual(
      Array.from({ length: 1234 }, (_, i) => `row-${i}`),
    );
    expect(listRows).toHaveBeenCalledTimes(13);
    expect(listRows.mock.calls.some(([args]) => queryOf(args, "cursorAfter"))).toBe(false);
  });

  it("falls back to the cursor walk when a row disappears mid-read", async () => {
    servePages(250);
    const serve = listRows.getMockImplementation()!;
    // The count says 251: one row was deleted after it was taken.
    listRows.mockImplementation(async (args: { queries: string[]; total: boolean }) => {
      const page = await serve(args);
      return args.total ? { ...page, total: 251 } : page;
    });

    const places = await listAllPlaces(ctx, MAP_ID);

    expect(places).toHaveLength(250);
    expect(new Set(places.map((place) => place.id)).size).toBe(250);
    expect(listRows.mock.calls.some(([args]) => queryOf(args, "cursorAfter"))).toBe(true);
  });

  it("breaks timestamp ties by sequence, so offsets keep the walk's order", async () => {
    servePages(150);

    await listAllPlaces(ctx, MAP_ID);

    for (const [args] of listRows.mock.calls) {
      expect(args.queries).toContain(JSON.stringify({ method: "orderAsc", attribute: "$sequence" }));
    }
  });
});

describe("listPlaces", () => {
  it("authorises its one page itself and keeps the total its callers show", async () => {
    servePages(10);

    await listPlaces(ctx, MAP_ID);

    expect(getRow).toHaveBeenCalledTimes(1);
    expect(listRows.mock.calls[0][0]).toMatchObject({ total: true });
  });
});
