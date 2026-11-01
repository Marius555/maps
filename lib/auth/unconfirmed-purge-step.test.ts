import { describe, expect, it, vi } from "vitest";

import {
  runUnconfirmedPurgeStep,
  UNCONFIRMED_GRACE_DAYS,
  UNCONFIRMED_PAGE,
  type UnconfirmedPurgeStore,
} from "./unconfirmed-purge-step";

/**
 * Who goes, who stays, and where the next step starts.
 *
 * The fake store behaves like Appwrite in the one way that matters: a deleted
 * account drops out of the next listing, and a cursor naming one would be
 * refused — so the step must only ever hand back a cursor that still exists.
 */

const NOW = new Date("2026-11-01T03:00:00.000Z");

type Account = { id: string; emailVerified: boolean; keep?: boolean };

function fakeStore(accounts: Account[]) {
  const live = new Map(accounts.map((account) => [account.id, account]));

  const store = {
    listUnconfirmed: vi.fn<UnconfirmedPurgeStore["listUnconfirmed"]>(async ({ cursor, limit }) => {
      const ids = [...live.keys()];
      if (cursor && !live.has(cursor)) throw new Error(`cursor ${cursor} names a deleted row`);
      const start = cursor ? ids.indexOf(cursor) + 1 : 0;
      return ids.slice(start, start + limit).map((id) => {
        const { emailVerified } = live.get(id)!;
        return { id, emailVerified };
      });
    }),
    mustKeep: vi.fn(async (id: string) => Boolean(live.get(id)?.keep)),
    deleteAccount: vi.fn(async (id: string) => {
      live.delete(id);
    }),
  } satisfies UnconfirmedPurgeStore;

  return { store, live };
}

const run = (store: UnconfirmedPurgeStore, cursor: string | null = null, deadline = Infinity) =>
  runUnconfirmedPurgeStep(store, { cursor, deadline, now: NOW });

describe("runUnconfirmedPurgeStep", () => {
  it("asks only for accounts older than the grace period", async () => {
    const { store } = fakeStore([]);

    await run(store);

    const cutoff = new Date(NOW.getTime() - UNCONFIRMED_GRACE_DAYS * 86_400_000).toISOString();
    expect(store.listUnconfirmed).toHaveBeenCalledWith({
      registeredBefore: cutoff,
      cursor: null,
      limit: UNCONFIRMED_PAGE,
    });
  });

  it("deletes accounts with nothing to keep and is done when the page is short", async () => {
    const { store, live } = fakeStore([
      { id: "a", emailVerified: false },
      { id: "b", emailVerified: false },
    ]);

    await expect(run(store)).resolves.toEqual({ cursor: null, more: false, deleted: 2, kept: 0 });
    expect(live.size).toBe(0);
  });

  it("keeps an account that owns a map or has a subscription, and one that reads as confirmed", async () => {
    const { store, live } = fakeStore([
      { id: "maps", emailVerified: false, keep: true },
      { id: "bot", emailVerified: false },
      { id: "confirmed", emailVerified: true },
    ]);

    await expect(run(store)).resolves.toMatchObject({ deleted: 1, kept: 2 });
    expect([...live.keys()]).toEqual(["maps", "confirmed"]);
    expect(store.deleteAccount).not.toHaveBeenCalledWith("maps");
    expect(store.deleteAccount).not.toHaveBeenCalledWith("confirmed");
  });

  it("walks a long list to the end without ever handing back a deleted account as the cursor", async () => {
    const accounts: Account[] = Array.from({ length: UNCONFIRMED_PAGE * 2 + 3 }, (_, index) => ({
      id: `u${String(index).padStart(3, "0")}`,
      emailVerified: false,
      // Every seventh is kept, so cursors land between deletions.
      keep: index % 7 === 0,
    }));
    const { store, live } = fakeStore(accounts);

    let cursor: string | null = null;
    let steps = 0;
    for (;;) {
      const step = await run(store, cursor);
      steps += 1;
      if (!step.more) break;
      cursor = step.cursor;
      expect(steps).toBeLessThan(20);
    }

    expect([...live.values()].every((account) => account.keep)).toBe(true);
    expect(live.size).toBe(accounts.filter((account) => account.keep).length);
  });

  it("stops at the deadline after doing some work, and resumes from where it stopped", async () => {
    const { store, live } = fakeStore([
      { id: "a", emailVerified: false, keep: true },
      { id: "b", emailVerified: false },
      { id: "c", emailVerified: false },
    ]);

    const first = await run(store, null, -1);
    expect(first).toEqual({ cursor: "a", more: true, deleted: 0, kept: 1 });

    const second = await run(store, first.cursor);
    expect(second).toEqual({ cursor: null, more: false, deleted: 2, kept: 0 });
    expect([...live.keys()]).toEqual(["a"]);
  });
});
