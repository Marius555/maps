import { describe, expect, it } from "vitest";

import { runDeletionStep, type DeletionStore } from "./step";

/**
 * The order deletion runs in, and that it can stop anywhere and pick up again.
 *
 * Tested against an in-memory account rather than Appwrite, because what can go
 * wrong here is the order. A row deleted before its files leaves photos online
 * with nothing pointing at them. A login deleted before the maps leaves maps
 * that nobody can sign in to delete. Both look fine from the dialog.
 */

type FakeMap = { places: { id: string; files: string[] }[] };

function fakeAccount(maps: Record<string, FakeMap>, pageSize = 2) {
  const log: string[] = [];
  const files = new Set(Object.values(maps).flatMap((map) => map.places.flatMap((p) => p.files)));
  let userDeleted = false;

  const store: DeletionStore = {
    listMapIds: async () => Object.keys(maps),
    takePlaceFiles: async (mapId) => {
      const page = maps[mapId]!.places.slice(0, pageSize);
      return { placeIds: page.map((p) => p.id), fileIds: page.flatMap((p) => p.files) };
    },
    deleteFiles: async (ids) => {
      for (const id of ids) files.delete(id);
      log.push(`files:${ids.join(",")}`);
    },
    deletePlaces: async (mapId, ids) => {
      // Every file a deleted row named must already be gone.
      for (const place of maps[mapId]!.places.filter((p) => ids.includes(p.id))) {
        for (const file of place.files) expect(files.has(file)).toBe(false);
      }
      maps[mapId]!.places = maps[mapId]!.places.filter((p) => !ids.includes(p.id));
      log.push(`places:${mapId}:${ids.join(",")}`);
    },
    deleteEmptiedMap: async (mapId) => {
      expect(maps[mapId]!.places).toHaveLength(0);
      delete maps[mapId];
      log.push(`map:${mapId}`);
    },
    deleteAccountRows: async () => {
      expect(Object.keys(maps)).toHaveLength(0);
      log.push("account-rows");
    },
    deleteUser: async () => {
      userDeleted = true;
      log.push("user");
    },
  };

  return { store, log, files, maps, isUserDeleted: () => userDeleted };
}

describe("runDeletionStep", () => {
  it("deletes files, then rows, then maps, then the account, then the login", async () => {
    const account = fakeAccount({
      a: { places: [{ id: "p1", files: ["f1", "f2"] }, { id: "p2", files: [] }, { id: "p3", files: ["f3"] }] },
      b: { places: [] },
    });

    const progress = await runDeletionStep(account.store, { budgetMs: 60_000 });

    expect(progress).toEqual({ done: true, mapsLeft: 0 });
    expect(account.log).toEqual([
      "files:f1,f2",
      "places:a:p1,p2",
      "files:f3",
      "places:a:p3",
      "map:a",
      "map:b",
      "account-rows",
      "user",
    ]);
    expect(account.files.size).toBe(0);
  });

  it("stops when the budget runs out, and the next step finishes the job", async () => {
    const account = fakeAccount({
      a: { places: [{ id: "p1", files: ["f1"] }, { id: "p2", files: ["f2"] }, { id: "p3", files: ["f3"] }] },
      b: { places: [{ id: "q1", files: ["g1"] }] },
    }, 1);

    // A clock that advances one "second" per reading, against a three-second budget.
    let tick = 0;
    const now = () => (tick += 1_000);

    const first = await runDeletionStep(account.store, { budgetMs: 3_000, now });

    expect(first.done).toBe(false);
    expect(first.mapsLeft).toBe(2);
    expect(account.isUserDeleted()).toBe(false);

    // Whatever the first step left, the rest of the deletion picks up from.
    let progress = first;
    for (let guard = 0; !progress.done && guard < 20; guard += 1) {
      progress = await runDeletionStep(account.store, { budgetMs: 3_000, now });
    }

    expect(progress).toEqual({ done: true, mapsLeft: 0 });
    expect(account.files.size).toBe(0);
    expect(Object.keys(account.maps)).toHaveLength(0);
    expect(account.log.at(-1)).toBe("user");
  });

  it("never deletes the login while a map remains", async () => {
    const account = fakeAccount({ a: { places: [{ id: "p1", files: [] }] } });

    // No time at all: the step must hand back before touching anything final.
    const progress = await runDeletionStep(account.store, { budgetMs: 0 });

    expect(progress).toEqual({ done: false, mapsLeft: 1 });
    expect(account.log).toEqual([]);
  });

  it("finishes an account that has no maps in one step", async () => {
    const account = fakeAccount({});

    expect(await runDeletionStep(account.store)).toEqual({ done: true, mapsLeft: 0 });
    expect(account.log).toEqual(["account-rows", "user"]);
  });
});
