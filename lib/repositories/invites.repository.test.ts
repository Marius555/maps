import { createHash } from "node:crypto";

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { createFakeTables, type FakeTables } from "@/lib/test/fake-tables";

/**
 * Invites are where a seat limit, a role check and an identity check meet, and
 * each one failing open is a different kind of breach: a team past what it
 * paid for, an editor handing out admin, or a stranger holding the link walking
 * into somebody's maps. So these run against an in-memory copy of the three
 * tables the decision reads — invites, memberships, subscriptions — rather than
 * against mocks of each call, so a count and the rows it counts cannot disagree.
 */

vi.mock("@/lib/env", () => ({
  env: { appwriteApiKey: "test-key", databaseId: "test-db", storageId: "test-store" },
}));

const state = vi.hoisted(() => ({
  fake: null as FakeTables | null,
  people: new Map<string, { id: string; name: string; email: string }>(),
}));

vi.mock("@/lib/appwrite/admin", () => ({
  admin: {
    tablesDB: new Proxy(
      {},
      { get: (_target, key: string) => (state.fake!.api as Record<string, unknown>)[key] },
    ),
  },
}));

vi.mock("@/lib/auth/people", () => ({
  readPeople: async (ids: string[]) =>
    new Map(ids.filter((id) => state.people.has(id)).map((id) => [id, state.people.get(id)!])),
}));

const OWNER = "owner-1";
const DAY = 24 * 60 * 60 * 1000;

function person(id: string, email: string) {
  state.people.set(id, { id, name: id, email });
}

function onPlan(plan: "starter" | "pro") {
  state.fake!.seed("subscriptions", [
    { $id: `sub-${plan}`, userId: OWNER, plan, status: "active" },
  ]);
}

function member(userId: string, role: "admin" | "editor" | "viewer", joinedAt?: string) {
  state.fake!.seed("memberships", [
    { $id: `m-${userId}`, workspaceId: OWNER, userId, role, ...(joinedAt ? { $createdAt: joinedAt } : {}) },
  ]);
}

function invite(email: string, options: { expiresIn?: number; role?: string; sentAgo?: number } = {}) {
  const id = `inv-${email}`;

  state.fake!.seed("invites", [
    {
      $id: id,
      workspaceId: OWNER,
      email,
      role: options.role ?? "editor",
      invitedBy: OWNER,
      tokenHash: hash(`token-for-${email}`),
      expiresAt: new Date(Date.now() + (options.expiresIn ?? DAY)).toISOString(),
      sentAt: new Date(Date.now() - (options.sentAgo ?? 2 * 60 * 1000)).toISOString(),
    },
  ]);

  return id;
}

function hash(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

async function load() {
  const [invites, context] = await Promise.all([
    import("./invites.repository"),
    import("./context"),
  ]);

  return { ...invites, ...context };
}

beforeEach(() => {
  vi.resetModules();
  vi.stubEnv("DISABLE_ALL_PLAN", "");
  state.people.clear();
  state.fake = createFakeTables({
    invites: [["tokenHash"], ["workspaceId", "email"]],
    memberships: [["workspaceId", "userId"]],
  });
  person(OWNER, "owner@example.com");
});

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("createInvite", () => {
  it("stores only a hash of the token it hands back", async () => {
    onPlan("starter");
    const { createInvite, ownerContext } = await load();

    const { token, invite } = await createInvite(ownerContext(OWNER), {
      email: "Ada@Example.com",
      role: "editor",
    });

    const [row] = state.fake!.rows("invites");
    expect(token).toMatch(/^[A-Za-z0-9_-]{43}$/);
    expect(row.tokenHash).toBe(hash(token));
    expect(JSON.stringify(row)).not.toContain(token);
    expect(invite.email).toBe("ada@example.com");
  });

  it("refuses on Free, which is one seat: the owner", async () => {
    const { createInvite, ownerContext } = await load();

    await expect(
      createInvite(ownerContext(OWNER), { email: "ada@example.com", role: "editor" }),
    ).rejects.toMatchObject({ code: "plan_limit_reached", status: 403 });
    expect(state.fake!.rows("invites")).toHaveLength(0);
  });

  it("counts the owner, every member and every live invite", async () => {
    onPlan("starter");
    member("u-2", "editor");
    invite("pending@example.com");
    const { createInvite, ownerContext } = await load();

    await expect(
      createInvite(ownerContext(OWNER), { email: "one-more@example.com", role: "viewer" }),
    ).rejects.toMatchObject({ code: "plan_limit_reached" });
  });

  it("does not count an expired invite", async () => {
    onPlan("starter");
    member("u-2", "editor");
    invite("lapsed@example.com", { expiresIn: -DAY });
    const { createInvite, ownerContext } = await load();

    await expect(
      createInvite(ownerContext(OWNER), { email: "fresh@example.com", role: "viewer" }),
    ).resolves.toMatchObject({ invite: { email: "fresh@example.com" } });
  });

  it("leaves at most one invite when two race for the last seat", async () => {
    onPlan("starter");
    member("u-2", "editor");
    const { createInvite, ownerContext } = await load();
    const ctx = ownerContext(OWNER);

    const results = await Promise.allSettled([
      createInvite(ctx, { email: "a@example.com", role: "viewer" }),
      createInvite(ctx, { email: "b@example.com", role: "viewer" }),
    ]);

    expect(state.fake!.rows("invites").length).toBeLessThanOrEqual(1);
    expect(results.some((result) => result.status === "rejected")).toBe(true);
  });

  it("refuses an address already on the team, the owner's included", async () => {
    onPlan("pro");
    person("u-2", "member@example.com");
    member("u-2", "editor");
    const { createInvite, ownerContext } = await load();

    for (const email of ["member@example.com", "OWNER@example.com"]) {
      await expect(
        createInvite(ownerContext(OWNER), { email, role: "viewer" }),
      ).rejects.toMatchObject({ code: "conflict" });
    }
  });

  it("refuses a second live invite to the same address", async () => {
    onPlan("pro");
    invite("ada@example.com");
    const { createInvite, ownerContext } = await load();

    await expect(
      createInvite(ownerContext(OWNER), { email: "ada@example.com", role: "viewer" }),
    ).rejects.toMatchObject({ code: "conflict" });
  });

  it("lets only the owner invite admins, and nobody below admin invite at all", async () => {
    onPlan("pro");
    const { createInvite, memberContext, ownWorkspace } = await load();
    const team = ownWorkspace(OWNER);

    await expect(
      createInvite(memberContext(team, "u-admin", "admin"), { email: "x@example.com", role: "admin" }),
    ).rejects.toMatchObject({ code: "role_required" });
    await expect(
      createInvite(memberContext(team, "u-editor", "editor"), { email: "x@example.com", role: "viewer" }),
    ).rejects.toMatchObject({ code: "role_required" });
    await expect(
      createInvite(memberContext(team, "u-admin", "admin"), { email: "x@example.com", role: "editor" }),
    ).resolves.toMatchObject({ invite: { role: "editor", invitedBy: "u-admin" } });
  });
});

describe("acceptInvite", () => {
  it("joins the team in the invited role and uses the invite up", async () => {
    onPlan("starter");
    const id = invite("ada@example.com", { role: "viewer" });
    const { acceptInvite, findInviteByToken } = await load();
    const found = await findInviteByToken("token-for-ada@example.com");

    await acceptInvite({ id: "u-ada", email: "ADA@example.com" }, found!);

    expect(state.fake!.rows("memberships")).toMatchObject([
      { workspaceId: OWNER, userId: "u-ada", role: "viewer" },
    ]);
    expect(state.fake!.rows("invites").find((row) => row.$id === id)).toBeUndefined();
  });

  it("succeeds when the team is exactly full — the invite already held the seat", async () => {
    onPlan("starter");
    member("u-2", "editor");
    invite("ada@example.com");
    const { acceptInvite, findInviteByToken } = await load();

    await acceptInvite(
      { id: "u-ada", email: "ada@example.com" },
      (await findInviteByToken("token-for-ada@example.com"))!,
    );

    expect(state.fake!.rows("memberships")).toHaveLength(2);
  });

  it("refuses once a downgrade has left no seat for it", async () => {
    onPlan("starter");
    member("u-2", "editor");
    member("u-3", "editor");
    invite("ada@example.com");
    const { acceptInvite, findInviteByToken } = await load();

    await expect(
      acceptInvite(
        { id: "u-ada", email: "ada@example.com" },
        (await findInviteByToken("token-for-ada@example.com"))!,
      ),
    ).rejects.toMatchObject({ code: "plan_limit_reached" });
    expect(state.fake!.rows("memberships")).toHaveLength(2);
  });

  it("refuses anybody but the address it was sent to, whoever holds the link", async () => {
    onPlan("pro");
    invite("ada@example.com");
    const { acceptInvite, findInviteByToken } = await load();

    await expect(
      acceptInvite(
        { id: "u-eve", email: "eve@example.com" },
        (await findInviteByToken("token-for-ada@example.com"))!,
      ),
    ).rejects.toMatchObject({ code: "forbidden", status: 403 });
    expect(state.fake!.rows("memberships")).toHaveLength(0);
  });

  it("refuses an expired invite", async () => {
    onPlan("pro");
    invite("ada@example.com", { expiresIn: -1000 });
    const { acceptInvite, findInviteByToken } = await load();

    await expect(
      acceptInvite(
        { id: "u-ada", email: "ada@example.com" },
        (await findInviteByToken("token-for-ada@example.com"))!,
      ),
    ).rejects.toMatchObject({ code: "not_found" });
  });

  it("never changes the role of somebody already on the team", async () => {
    onPlan("pro");
    member("u-ada", "viewer");
    invite("ada@example.com", { role: "admin" });
    const { acceptInvite, findInviteByToken } = await load();

    await acceptInvite(
      { id: "u-ada", email: "ada@example.com" },
      (await findInviteByToken("token-for-ada@example.com"))!,
    );

    expect(state.fake!.rows("memberships")).toMatchObject([{ userId: "u-ada", role: "viewer" }]);
    expect(state.fake!.rows("invites")).toHaveLength(0);
  });

  it("refuses the owner their own team", async () => {
    onPlan("pro");
    invite("owner@example.com");
    const { acceptInvite, findInviteByToken } = await load();

    await expect(
      acceptInvite(
        { id: OWNER, email: "owner@example.com" },
        (await findInviteByToken("token-for-owner@example.com"))!,
      ),
    ).rejects.toMatchObject({ code: "conflict" });
    expect(state.fake!.rows("memberships")).toHaveLength(0);
  });
});

describe("resendInvite and revokeInvite", () => {
  it("kills the old link when it sends a new one", async () => {
    onPlan("pro");
    const id = invite("ada@example.com");
    const { findInviteByToken, ownerContext, resendInvite } = await load();

    const { token } = await resendInvite(ownerContext(OWNER), id);

    expect(await findInviteByToken("token-for-ada@example.com")).toBeNull();
    expect(await findInviteByToken(token)).toMatchObject({ id });
  });

  it("will not mail the same address twice inside a minute", async () => {
    onPlan("pro");
    const id = invite("ada@example.com", { sentAgo: 5_000 });
    const { ownerContext, resendInvite } = await load();

    await expect(resendInvite(ownerContext(OWNER), id)).rejects.toMatchObject({
      code: "rate_limited",
      status: 429,
    });
  });

  it("lets an admin take back an editor's invite but not an admin's", async () => {
    onPlan("pro");
    const editorInvite = invite("ed@example.com", { role: "editor" });
    const adminInvite = invite("ad@example.com", { role: "admin" });
    const { memberContext, ownWorkspace, revokeInvite } = await load();
    const ctx = memberContext(ownWorkspace(OWNER), "u-admin", "admin");

    await expect(revokeInvite(ctx, adminInvite)).rejects.toMatchObject({ code: "role_required" });
    await revokeInvite(ctx, editorInvite);

    expect(state.fake!.rows("invites").map((row) => row.$id)).toEqual([adminInvite]);
  });

  it("answers another team's invite as missing", async () => {
    onPlan("pro");
    const id = invite("ada@example.com");
    const { ownerContext, revokeInvite } = await load();

    await expect(revokeInvite(ownerContext("someone-else"), id)).rejects.toMatchObject({
      code: "not_found",
    });
  });
});
