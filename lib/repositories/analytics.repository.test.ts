import { beforeEach, describe, expect, it, vi } from "vitest";

import { AppwriteException } from "node-appwrite";

/**
 * One visit is one row.
 *
 * That sentence is the entire cost argument for visitor analytics existing
 * (CLAUDE.md §2, and the arithmetic in docs/notes/analytics.md), and it was
 * false in the first version of this feature while every comment claimed it was
 * true. The embed does send one beacon per session — but it flushes whenever the
 * page is *hidden*, not only when it is closed, and pressing Directions opens a
 * new tab and hides the page. So the most important action on a store locator
 * ended a "session" and the next click started another row.
 *
 * The symptom is quiet and expensive: nothing errors, the dashboard just counts
 * an engaged visitor three or four times and the monthly ceiling fills that much
 * faster. These tests are here so it cannot come back silently.
 */

vi.mock("@/lib/env", () => ({
  env: { appwriteApiKey: "test-key", databaseId: "test-db", storageId: "test-store" },
}));

const getRow = vi.fn();
const createRow = vi.fn();
const updateRow = vi.fn();
const listRows = vi.fn();

vi.mock("@/lib/appwrite/admin", () => ({
  admin: {
    tablesDB: {
      getRow: (...args: unknown[]) => getRow(...args),
      createRow: (...args: unknown[]) => createRow(...args),
      updateRow: (...args: unknown[]) => updateRow(...args),
      listRows: (...args: unknown[]) => listRows(...args),
    },
  },
}));

import { recordSession, type RecordSessionInput } from "./analytics.repository";

const MAP_ID = "map-1";

function conflict(): AppwriteException {
  return new AppwriteException("Row already exists", 409, "row_already_exists");
}

function input(overrides: Partial<RecordSessionInput> = {}): RecordSessionInput {
  return {
    mapId: MAP_ID,
    sessionId: "session-a",
    startedAt: new Date("2026-09-07T10:00:00.000Z"),
    country: "LT",
    city: "Vilnius",
    lat: 54.68,
    lng: 25.27,
    ip: "81.7.144.23",
    host: "shop.example.com",
    path: "/find-us",
    referrer: "",
    device: "desktop",
    events: [{ t: "view", o: 0 }],
    ...overrides,
  };
}

/** What `createRow`/`updateRow` was called with, without the plumbing. */
function lastCall(mock: typeof createRow): { rowId: string; data: Record<string, unknown> } {
  const call = mock.mock.calls.at(-1)?.[0] as {
    rowId: string;
    data: Record<string, unknown>;
  };

  return call;
}

beforeEach(() => {
  vi.clearAllMocks();
  createRow.mockResolvedValue({});
  updateRow.mockResolvedValue({});
});

describe("recordSession", () => {
  it("gives one session one row id, however many times it flushes", async () => {
    await recordSession(input());
    const first = lastCall(createRow).rowId;

    createRow.mockClear();
    await recordSession(input({ events: [{ t: "open", o: 900 }] }));

    expect(lastCall(createRow).rowId).toBe(first);
  });

  it("gives two sessions two different rows", async () => {
    await recordSession(input({ sessionId: "session-a" }));
    const a = lastCall(createRow).rowId;

    await recordSession(input({ sessionId: "session-b" }));

    expect(lastCall(createRow).rowId).not.toBe(a);
  });

  it("keeps two maps apart even if a session id repeats", async () => {
    // The session id is client-authored and random per page load, so a
    // collision across maps is not impossible — and merging two customers'
    // visitors into one row would be the worst kind of wrong.
    await recordSession(input({ mapId: "map-1" }));
    const a = lastCall(createRow).rowId;

    await recordSession(input({ mapId: "map-2" }));

    expect(lastCall(createRow).rowId).not.toBe(a);
  });

  it("appends a later flush to the row already stored", async () => {
    createRow.mockRejectedValueOnce(conflict());
    getRow.mockResolvedValueOnce({
      events: JSON.stringify([{ t: "view", o: 0 }]),
    });

    await recordSession(input({ events: [{ t: "directions", o: 31_313 }] }));

    expect(createRow).not.toHaveBeenCalledTimes(2);
    expect(lastCall(updateRow).data).toEqual({
      events: JSON.stringify([
        { t: "view", o: 0 },
        { t: "directions", o: 31_313 },
      ]),
      eventCount: 2,
    });
  });

  it("keeps the events in the order they happened", async () => {
    createRow.mockRejectedValueOnce(conflict());
    getRow.mockResolvedValueOnce({
      events: JSON.stringify([
        { t: "view", o: 0 },
        { t: "search", o: 4_000 },
      ]),
    });

    await recordSession(input({ events: [{ t: "open", o: 9_000 }] }));

    const stored = JSON.parse(
      lastCall(updateRow).data.events as string,
    ) as { o: number }[];

    expect(stored.map((event) => event.o)).toEqual([0, 4_000, 9_000]);
  });

  it("does not let an append grow a row past the event cap", async () => {
    // Otherwise the cap is per beacon rather than per session, and a page left
    // open all day is unbounded storage a visitor can spend for us.
    createRow.mockRejectedValueOnce(conflict());
    getRow.mockResolvedValueOnce({
      events: JSON.stringify(
        Array.from({ length: 58 }, (_, index) => ({ t: "pin", o: index })),
      ),
    });

    await recordSession(
      input({
        events: Array.from({ length: 20 }, (_, index) => ({
          t: "open",
          o: 1_000 + index,
        })),
      }),
    );

    expect(lastCall(updateRow).data.eventCount).toBe(60);
  });

  it("survives a stored row whose events cannot be read", async () => {
    // A row we cannot parse is a row to add to, not a request to fail: the
    // visitor is gone and there is nothing to retry.
    createRow.mockRejectedValueOnce(conflict());
    getRow.mockResolvedValueOnce({ events: "not json" });

    await recordSession(input({ events: [{ t: "open", o: 5 }] }));

    expect(lastCall(updateRow).data.eventCount).toBe(1);
  });

  it("still throws on a failure that is not a conflict", async () => {
    createRow.mockRejectedValueOnce(
      new AppwriteException("Service unavailable", 503, "general_unknown"),
    );

    await expect(recordSession(input())).rejects.toThrow();
    expect(updateRow).not.toHaveBeenCalled();
  });
});
