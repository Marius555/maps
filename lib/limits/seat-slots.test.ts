import { describe, expect, it } from "vitest";

import { effectiveRole, seatHolders } from "./seat-slots";

const member = (userId: string, joinedAt: string, id = `m-${userId}`) => ({ userId, joinedAt, id });

describe("seatHolders", () => {
  it("keeps everybody when the team fits", () => {
    const holders = seatHolders([member("a", "2026-01-01"), member("b", "2026-01-02")], 3);

    expect([...holders].sort()).toEqual(["a", "b"]);
  });

  it("gives the owner a seat before any member", () => {
    expect(seatHolders([member("a", "2026-01-01")], 1).size).toBe(0);
  });

  it("keeps the earliest to join, whatever order they arrive in", () => {
    const holders = seatHolders(
      [member("late", "2026-03-01"), member("early", "2026-01-01"), member("middle", "2026-02-01")],
      3,
    );

    expect([...holders].sort()).toEqual(["early", "middle"]);
  });

  it("breaks a tie in join time by row id, so the answer never wobbles", () => {
    const holders = seatHolders(
      [member("b", "2026-01-01", "m-2"), member("a", "2026-01-01", "m-1")],
      2,
    );

    expect([...holders]).toEqual(["a"]);
  });
});

describe("effectiveRole", () => {
  it("is the member's own role while they hold a seat", () => {
    expect(effectiveRole("admin", "a", new Set(["a"]))).toBe("admin");
  });

  it("is viewer for a member past the seats — read-only, never removed", () => {
    expect(effectiveRole("admin", "b", new Set(["a"]))).toBe("viewer");
  });
});
