import { beforeEach, describe, expect, it, vi } from "vitest";

import type { MapSession } from "@/lib/repositories/types";

/**
 * The purge the Privacy Policy and DPA promise. Two things must hold: a plan's
 * retention period is what decides the cutoff, and a day with no rollup is
 * folded *before* its raw sessions go — otherwise the charts lose it for good.
 */

const listMapsForRetention = vi.fn();
const oldestExpiredDay = vi.fn();
const hasDailyRollup = vi.fn();
const readDaySessions = vi.fn();
const storeDailyRollup = vi.fn();
const deleteDaySessions = vi.fn();
const getUserPlan = vi.fn();

vi.mock("@/lib/repositories/analytics.repository", () => ({
  listMapsForRetention,
  oldestExpiredDay,
  hasDailyRollup,
  readDaySessions,
  storeDailyRollup,
  deleteDaySessions,
}));
vi.mock("@/lib/repositories/plan-limits", async () => ({
  SESSION_LIMITS: (await import("@/lib/limits/plans")).SESSION_LIMITS,
  getUserPlan,
}));

const { purgeExpiredSessions, retentionCutoff } = await import("./retention");

const NOW = new Date("2026-10-04T03:00:00Z");
const FAR = Number.MAX_SAFE_INTEGER;

function session(day: string): MapSession {
  return {
    id: `s-${day}`,
    mapId: "m1",
    startedAt: `${day}T10:00:00.000Z`,
    day,
    country: "LT",
    city: null,
    lat: null,
    lng: null,
    ip: null,
    host: "shop.example.com",
    path: "/",
    referrer: "",
    device: "desktop",
    events: [{ type: "view", at: 0, data: {} }],
    visitor: null,
    returning: false,
  };
}

/** A map whose expired days are handed out oldest first, then none. */
function expiredDays(days: string[]) {
  const queue = [...days];
  oldestExpiredDay.mockImplementation(async () => queue.shift() ?? null);
}

beforeEach(() => {
  vi.clearAllMocks();
  getUserPlan.mockResolvedValue("free");
  hasDailyRollup.mockResolvedValue(true);
  readDaySessions.mockResolvedValue({ sessions: [], truncated: false });
});

describe("retentionCutoff", () => {
  it("keeps exactly the plan's retention period", () => {
    expect(retentionCutoff("free", NOW)).toBe("2026-09-04");
    expect(retentionCutoff("starter", NOW)).toBe("2026-04-07");
    expect(retentionCutoff("pro", NOW)).toBe("2025-10-04");
  });
});

describe("purgeExpiredSessions", () => {
  it("asks each map about its own owner's plan", async () => {
    listMapsForRetention.mockResolvedValue({
      maps: [
        { id: "m1", ownerId: "free-owner" },
        { id: "m2", ownerId: "pro-owner" },
      ],
      next: null,
    });
    getUserPlan.mockImplementation(async (id: string) =>
      id === "pro-owner" ? "pro" : "free",
    );
    oldestExpiredDay.mockResolvedValue(null);

    await purgeExpiredSessions({ cursor: null, deadline: FAR, now: NOW });

    expect(oldestExpiredDay).toHaveBeenCalledWith("m1", "2026-09-04");
    expect(oldestExpiredDay).toHaveBeenCalledWith("m2", "2025-10-04");
  });

  it("folds a day with no rollup before deleting it", async () => {
    listMapsForRetention.mockResolvedValue({
      maps: [{ id: "m1", ownerId: "u" }],
      next: null,
    });
    expiredDays(["2026-08-01"]);
    hasDailyRollup.mockResolvedValue(false);
    readDaySessions.mockResolvedValue({
      sessions: [session("2026-08-01"), session("2026-08-01")],
      truncated: false,
    });

    const result = await purgeExpiredSessions({ cursor: null, deadline: FAR, now: NOW });

    expect(storeDailyRollup).toHaveBeenCalledWith(
      "m1",
      expect.objectContaining({ day: "2026-08-01", sessions: 2 }),
    );
    expect(storeDailyRollup.mock.invocationCallOrder[0]).toBeLessThan(
      deleteDaySessions.mock.invocationCallOrder[0],
    );
    expect(deleteDaySessions).toHaveBeenCalledWith("m1", "2026-08-01");
    expect(result).toEqual({ cursor: null, purgedDays: 1 });
  });

  it("does not re-fold a day that is already rolled up", async () => {
    listMapsForRetention.mockResolvedValue({
      maps: [{ id: "m1", ownerId: "u" }],
      next: null,
    });
    expiredDays(["2026-08-01", "2026-08-02"]);

    await purgeExpiredSessions({ cursor: null, deadline: FAR, now: NOW });

    expect(readDaySessions).not.toHaveBeenCalled();
    expect(storeDailyRollup).not.toHaveBeenCalled();
    expect(deleteDaySessions).toHaveBeenCalledTimes(2);
  });

  it("deletes a day too big to fold rather than keeping it past retention", async () => {
    listMapsForRetention.mockResolvedValue({
      maps: [{ id: "m1", ownerId: "u" }],
      next: null,
    });
    expiredDays(["2026-08-01"]);
    hasDailyRollup.mockResolvedValue(false);
    readDaySessions.mockResolvedValue({
      sessions: [session("2026-08-01")],
      truncated: true,
    });

    await purgeExpiredSessions({ cursor: null, deadline: FAR, now: NOW });

    expect(storeDailyRollup).not.toHaveBeenCalled();
    expect(deleteDaySessions).toHaveBeenCalledWith("m1", "2026-08-01");
  });

  it("hands back the page's cursor when every map is done", async () => {
    listMapsForRetention.mockResolvedValue({
      maps: [{ id: "m1", ownerId: "u" }],
      next: "m1",
    });
    oldestExpiredDay.mockResolvedValue(null);

    const result = await purgeExpiredSessions({ cursor: "m0", deadline: FAR, now: NOW });

    expect(listMapsForRetention).toHaveBeenCalledWith("m0", expect.any(Number));
    expect(result).toEqual({ cursor: "m1", purgedDays: 0 });
  });

  it("out of time mid-map, resumes at that same map next step", async () => {
    listMapsForRetention.mockResolvedValue({
      maps: [
        { id: "m1", ownerId: "u" },
        { id: "m2", ownerId: "u" },
      ],
      next: "m2",
    });
    oldestExpiredDay.mockImplementation(async (mapId: string) =>
      mapId === "m1" ? null : "2026-08-01",
    );

    // Already past the deadline: one day of progress, then stop.
    const result = await purgeExpiredSessions({ cursor: "m0", deadline: 0, now: NOW });

    expect(deleteDaySessions).toHaveBeenCalledTimes(1);
    expect(result).toEqual({ cursor: "m1", purgedDays: 1 });
  });
});
