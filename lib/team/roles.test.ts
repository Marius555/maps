import { describe, expect, it } from "vitest";

import { can, canManage, MEMBER_ROLES, type TeamAction, type WorkspaceRole } from "./roles";

/**
 * The whole role model is this table. The server's checks and the dashboard's
 * hidden buttons both read it, so a wrong cell here is wrong in both places at
 * once — which is why every cell is written out rather than derived.
 */
const EXPECTED: Record<WorkspaceRole, Record<TeamAction, boolean>> = {
  owner: { view: true, edit: true, deleteMap: true, manageMembers: true, manageAdmins: true, leave: false },
  admin: { view: true, edit: true, deleteMap: true, manageMembers: true, manageAdmins: false, leave: true },
  editor: { view: true, edit: true, deleteMap: false, manageMembers: false, manageAdmins: false, leave: true },
  viewer: { view: true, edit: false, deleteMap: false, manageMembers: false, manageAdmins: false, leave: true },
};

describe("can", () => {
  for (const [role, actions] of Object.entries(EXPECTED)) {
    for (const [action, allowed] of Object.entries(actions)) {
      it(`${allowed ? "lets" : "refuses"} ${role} ${action}`, () => {
        expect(can(role as WorkspaceRole, action as TeamAction)).toBe(allowed);
      });
    }
  }
});

describe("canManage", () => {
  it("lets the owner do anything to any member role", () => {
    for (const from of [null, ...MEMBER_ROLES]) {
      for (const to of [null, ...MEMBER_ROLES]) {
        if (from === null && to === null) continue;
        expect(canManage("owner", from, to)).toBe(true);
      }
    }
  });

  it("lets an admin move people between editor and viewer", () => {
    expect(canManage("admin", null, "editor")).toBe(true);
    expect(canManage("admin", "viewer", "editor")).toBe(true);
    expect(canManage("admin", "editor", null)).toBe(true);
  });

  it("never lets an admin make, unmake or remove an admin", () => {
    expect(canManage("admin", null, "admin")).toBe(false);
    expect(canManage("admin", "editor", "admin")).toBe(false);
    expect(canManage("admin", "admin", "viewer")).toBe(false);
    expect(canManage("admin", "admin", null)).toBe(false);
  });

  it("lets editors and viewers manage nobody", () => {
    for (const actor of ["editor", "viewer"] as const) {
      expect(canManage(actor, null, "viewer")).toBe(false);
      expect(canManage(actor, "viewer", null)).toBe(false);
    }
  });

  it("treats a change from nothing to nothing as nothing to allow", () => {
    expect(canManage("owner", null, null)).toBe(false);
  });
});
