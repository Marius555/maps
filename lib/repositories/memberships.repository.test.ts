import { beforeEach, describe, expect, it, vi } from "vitest";

import { createFakeTables, type FakeTables } from "@/lib/test/fake-tables";

/**
 * Changing and removing members. `canManage` (lib/team/roles.test.ts) is the
 * rule; this is the proof the repository asks it, about the right rows, and
 * refuses the two things the rule cannot see — acting on yourself, and acting
 * on somebody who is not on this team.
 */

vi.mock("@/lib/env", () => ({
  env: { appwriteApiKey: "test-key", databaseId: "test-db", storageId: "test-store" },
}));

const state = vi.hoisted(() => ({ fake: null as FakeTables | null }));

vi.mock("@/lib/appwrite/admin", () => ({
  admin: {
    tablesDB: new Proxy(
      {},
      { get: (_target, key: string) => (state.fake!.api as Record<string, unknown>)[key] },
    ),
  },
}));

const OWNER = "owner-1";

async function load() {
  const [memberships, context] = await Promise.all([
    import("./memberships.repository"),
    import("./context"),
  ]);

  return { ...memberships, ...context };
}

beforeEach(() => {
  vi.resetModules();
  state.fake = createFakeTables({ memberships: [["workspaceId", "userId"]] });
  state.fake.seed("memberships", [
    { $id: "m-admin", workspaceId: OWNER, userId: "u-admin", role: "admin" },
    { $id: "m-editor", workspaceId: OWNER, userId: "u-editor", role: "editor" },
    { $id: "m-viewer", workspaceId: OWNER, userId: "u-viewer", role: "viewer" },
    { $id: "m-elsewhere", workspaceId: "other-team", userId: "u-editor", role: "admin" },
  ]);
});

describe("changeMemberRole", () => {
  it("lets the owner promote anybody, admin included", async () => {
    const { changeMemberRole, ownerContext } = await load();

    await changeMemberRole(ownerContext(OWNER), "u-viewer", "admin");

    expect(state.fake!.rows("memberships").find((row) => row.$id === "m-viewer")?.role).toBe("admin");
  });

  it("lets an admin move people between editor and viewer, and no further", async () => {
    const { changeMemberRole, memberContext, ownWorkspace } = await load();
    const admin = memberContext(ownWorkspace(OWNER), "u-admin", "admin");

    await changeMemberRole(admin, "u-viewer", "editor");
    await expect(changeMemberRole(admin, "u-editor", "admin")).rejects.toMatchObject({
      code: "role_required",
    });
  });

  it("refuses anybody changing their own role", async () => {
    const { changeMemberRole, memberContext, ownWorkspace } = await load();

    await expect(
      changeMemberRole(memberContext(ownWorkspace(OWNER), "u-admin", "admin"), "u-admin", "viewer"),
    ).rejects.toMatchObject({ code: "role_required" });
  });

  it("touches only this team's row for a person on several teams", async () => {
    const { changeMemberRole, ownerContext } = await load();

    await changeMemberRole(ownerContext(OWNER), "u-editor", "viewer");

    const rows = state.fake!.rows("memberships");
    expect(rows.find((row) => row.$id === "m-editor")?.role).toBe("viewer");
    expect(rows.find((row) => row.$id === "m-elsewhere")?.role).toBe("admin");
  });

  it("answers somebody who is not on the team as missing", async () => {
    const { changeMemberRole, ownerContext } = await load();

    await expect(
      changeMemberRole(ownerContext(OWNER), "u-stranger", "viewer"),
    ).rejects.toMatchObject({ code: "not_found" });
  });
});

describe("removeMember and leaveWorkspace", () => {
  it("lets an admin remove an editor but not another admin", async () => {
    const { memberContext, ownWorkspace, removeMember } = await load();
    const admin = memberContext(ownWorkspace(OWNER), "u-admin", "admin");

    await removeMember(admin, "u-editor");
    await expect(removeMember(admin, "u-admin")).rejects.toMatchObject({ code: "role_required" });

    expect(state.fake!.rows("memberships").map((row) => row.$id)).not.toContain("m-editor");
  });

  it("refuses an editor removing anybody", async () => {
    const { memberContext, ownWorkspace, removeMember } = await load();

    await expect(
      removeMember(memberContext(ownWorkspace(OWNER), "u-editor", "editor"), "u-viewer"),
    ).rejects.toMatchObject({ code: "role_required" });
  });

  it("lets any member leave, whatever their role", async () => {
    const { leaveWorkspace, ownWorkspace } = await load();

    await leaveWorkspace("u-viewer", ownWorkspace(OWNER));

    expect(state.fake!.rows("memberships").map((row) => row.$id)).not.toContain("m-viewer");
  });

  it("deletes a person's memberships both ways when their account goes", async () => {
    const { deleteMembershipsFor } = await load();

    await deleteMembershipsFor(OWNER);
    await deleteMembershipsFor("u-editor");

    expect(state.fake!.rows("memberships")).toEqual([]);
  });
});

describe("addMember", () => {
  it("never changes the role of somebody already in", async () => {
    const { addMember, ownWorkspace } = await load();

    const { membership, created } = await addMember(ownWorkspace(OWNER), "u-viewer", "admin");

    expect(created).toBe(false);
    expect(membership.role).toBe("viewer");
  });
});
