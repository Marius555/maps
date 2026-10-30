import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { createFakeTables, type FakeTables } from "@/lib/test/fake-tables";

/**
 * The resolver decides, on every request, whose data it is about and what the
 * signed-in person may do there. Every way it can be wrong is an access bug:
 * a removed member still in, a forged cookie honoured, a viewer treated as an
 * editor, a map in somebody else's workspace answered at all. These run against
 * in-memory tables so membership, plan and map rows are read the way the real
 * ones are.
 */

vi.mock("@/lib/env", () => ({
  env: { appwriteApiKey: "test-key", databaseId: "test-db", storageId: "test-store" },
}));
vi.mock("next/headers", () => ({ cookies: async () => ({ get: () => undefined }) }));
vi.mock("@/lib/snapshot/storage", () => ({ deleteSnapshots: vi.fn() }));

const state = vi.hoisted(() => ({ fake: null as FakeTables | null, reads: 0 }));

vi.mock("@/lib/appwrite/admin", () => ({
  admin: {
    tablesDB: new Proxy(
      {},
      {
        get: (_target, key: string) => {
          const method = (state.fake!.api as Record<string, (...args: unknown[]) => unknown>)[key];

          return (...args: unknown[]) => {
            state.reads += 1;
            return method(...args);
          };
        },
      },
    ),
  },
}));

vi.mock("@/lib/auth/people", () => ({
  readPeople: async (ids: string[]) =>
    new Map(ids.map((id) => [id, { id, name: `${id}-name`, email: `${id}@example.com` }])),
}));

const OWNER = "owner-1";

async function load() {
  return import("./resolve");
}

function seedMap(id: string, userId: string) {
  state.fake!.seed("maps", [{ $id: id, userId, name: id, slug: id, style: "streets", defaultLat: 0, defaultLng: 0, defaultZoom: 2 }]);
}

function seedMember(userId: string, role: string, joinedAt?: string) {
  state.fake!.seed("memberships", [
    { $id: `m-${userId}`, workspaceId: OWNER, userId, role, ...(joinedAt ? { $createdAt: joinedAt } : {}) },
  ]);
}

function onPlan(plan: "starter" | "pro") {
  state.fake!.seed("subscriptions", [{ $id: "sub", userId: OWNER, plan, status: "active" }]);
}

beforeEach(() => {
  vi.resetModules();
  vi.stubEnv("DISABLE_ALL_PLAN", "");
  state.fake = createFakeTables();
  state.reads = 0;
});

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("resolveActiveContext", () => {
  it("is the person's own workspace, with no read at all, when nothing is switched", async () => {
    const { resolveActiveContext } = await load();

    expect(await resolveActiveContext("u-1", undefined)).toEqual({
      workspaceId: "u-1",
      actorId: "u-1",
      role: "owner",
    });
    expect(await resolveActiveContext("u-1", "u-1")).toMatchObject({ role: "owner" });
    expect(state.reads).toBe(0);
  });

  it("is the team, in the member's role, when the cookie names one they are in", async () => {
    onPlan("pro");
    seedMember("u-1", "editor");
    const { resolveActiveContext } = await load();

    expect(await resolveActiveContext("u-1", OWNER)).toEqual({
      workspaceId: OWNER,
      actorId: "u-1",
      role: "editor",
    });
  });

  it("falls back home for a cookie naming a team they are not in — forged or removed", async () => {
    onPlan("pro");
    const { resolveActiveContext } = await load();

    expect(await resolveActiveContext("u-1", OWNER)).toEqual({
      workspaceId: "u-1",
      actorId: "u-1",
      role: "owner",
    });
  });
});

describe("resolveMapContext", () => {
  it("makes the owner the owner of their own map", async () => {
    seedMap("map-1", "u-1");
    const { resolveMapContext } = await load();

    expect((await resolveMapContext("u-1", "map-1")).ctx).toMatchObject({
      workspaceId: "u-1",
      role: "owner",
    });
  });

  it("puts a member in the map's workspace, whatever the cookie says", async () => {
    onPlan("pro");
    seedMap("map-1", OWNER);
    seedMember("u-1", "viewer");
    const { resolveMapContext } = await load();

    expect((await resolveMapContext("u-1", "map-1")).ctx).toEqual({
      workspaceId: OWNER,
      actorId: "u-1",
      role: "viewer",
    });
  });

  it("answers a stranger's request for a map as missing, never forbidden", async () => {
    seedMap("map-1", OWNER);
    const { resolveMapContext } = await load();

    await expect(resolveMapContext("u-1", "map-1")).rejects.toMatchObject({
      code: "not_found",
      status: 404,
    });
  });

  it("answers a map that does not exist the same way", async () => {
    const { resolveMapContext } = await load();

    await expect(resolveMapContext("u-1", "nope")).rejects.toMatchObject({ code: "not_found" });
  });

  it("reads a member who joined past the plan's seats as a viewer", async () => {
    onPlan("starter");
    seedMember("first", "editor", "2026-01-01T00:00:00.000Z");
    seedMember("second", "editor", "2026-02-01T00:00:00.000Z");
    seedMember("third", "admin", "2026-03-01T00:00:00.000Z");
    seedMap("map-1", OWNER);
    const { resolveMapContext } = await load();

    expect((await resolveMapContext("second", "map-1")).ctx.role).toBe("editor");
    expect((await resolveMapContext("third", "map-1")).ctx.role).toBe("viewer");
  });
});

describe("personalPlan", () => {
  it("is the best plan among the person's own and every team they are in", async () => {
    onPlan("pro");
    seedMember("u-1", "viewer");
    const { personalPlan } = await load();

    expect(await personalPlan("u-1")).toBe("pro");
    expect(await personalPlan("u-2")).toBe("free");
  });
});

describe("listWorkspacesFor", () => {
  it("lists the person's own first, then each team under its owner's name", async () => {
    seedMember("u-1", "editor");
    const { listWorkspacesFor } = await load();

    expect(await listWorkspacesFor("u-1", "Ada")).toEqual([
      { id: "u-1", name: "Ada", role: "owner", own: true },
      { id: OWNER, name: `${OWNER}-name`, role: "editor", own: false },
    ]);
  });
});
