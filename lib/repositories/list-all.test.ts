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

/** `count` rows, served in Appwrite's 100-row pages. */
function servePages(count: number) {
  let served = 0;

  listRows.mockImplementation(async () => {
    const size = Math.min(100, count - served);
    const rows = Array.from({ length: size }, (_, i) => ({ $id: `row-${served + i}` }));
    served += size;

    return { rows, total: 0 };
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

  it("does not ask Appwrite to count rows it pages through", async () => {
    servePages(150);

    await listAll(ctx, MAP_ID);

    for (const [args] of listRows.mock.calls) {
      expect(args).toMatchObject({ total: false });
    }
  });

  it("still refuses a map owned by somebody else, before reading a row", async () => {
    getRow.mockResolvedValue({ $id: MAP_ID, userId: "someone-else" });

    await expect(listAll(ctx, MAP_ID)).rejects.toBeInstanceOf(NotFoundError);
    expect(listRows).not.toHaveBeenCalled();
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
