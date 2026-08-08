import { beforeEach, describe, expect, it, vi } from "vitest";

import { PLAN_LIMITS } from "./plan-limits";

/**
 * Plan limits are the paywall. If this regresses, free accounts get the paid
 * product, so the enforcement is tested against the repository — the layer
 * CLAUDE.md §6 says must own it — rather than against the UI.
 */

vi.mock("@/lib/env", () => ({
  env: { appwriteApiKey: "test-key", databaseId: "test-db", storageId: "test-store" },
}));

const listRows = vi.fn();
const getRow = vi.fn();
const createRow = vi.fn();
const createRows = vi.fn();

vi.mock("@/lib/appwrite/admin", () => ({
  admin: {
    tablesDB: {
      listRows: (...args: unknown[]) => listRows(...args),
      getRow: (...args: unknown[]) => getRow(...args),
      createRow: (...args: unknown[]) => createRow(...args),
      createRows: (...args: unknown[]) => createRows(...args),
    },
  },
}));

const USER_ID = "user-1";
const MAP_ID = "map-1";
const ctx = { userId: USER_ID };

/** How many places the map already has. Set per test. */
let existingPlaceCount = 0;
/** The row `plan-limits` reads. Empty array means the free plan. */
let subscriptionRows: { plan?: string; status?: string }[] = [];

beforeEach(() => {
  vi.clearAllMocks();
  vi.resetModules();

  existingPlaceCount = 0;
  subscriptionRows = [];

  getRow.mockImplementation(async () => ({
    $id: MAP_ID,
    $createdAt: "2026-01-01T00:00:00.000Z",
    $updatedAt: "2026-01-01T00:00:00.000Z",
    userId: USER_ID,
    name: "Stockists",
    slug: "stockists",
    style: "liberty",
    defaultLat: 54.687,
    defaultLng: 25.28,
    defaultZoom: 11,
  }));

  // Both the subscription read and the place count go through listRows, so the
  // mock branches on which table was asked for.
  listRows.mockImplementation(async ({ tableId }: { tableId: string }) => {
    if (tableId === "subscriptions") {
      return { rows: subscriptionRows, total: subscriptionRows.length };
    }

    return { rows: [], total: existingPlaceCount };
  });

  createRow.mockImplementation(async ({ data }: { data: Record<string, unknown> }) => ({
    $id: "place-new",
    $createdAt: "2026-01-01T00:00:00.000Z",
    $updatedAt: "2026-01-01T00:00:00.000Z",
    ...data,
  }));

  createRows.mockImplementation(
    async ({ rows }: { rows: Record<string, unknown>[] }) => ({
      rows: rows.map((row, index) => ({
        $createdAt: "2026-01-01T00:00:00.000Z",
        $updatedAt: "2026-01-01T00:00:00.000Z",
        ...row,
        $id: `place-${index}`,
      })),
      total: rows.length,
    }),
  );
});

async function repository() {
  return import("./places.repository");
}

const placeInput = (name: string) => ({
  name,
  lat: 54.687,
  lng: 25.28,
  address: "",
  category: "",
  sortOrder: 0,
  geocodeStatus: "manual" as const,
});

describe("createPlace", () => {
  it("allows a place below the free plan's limit", async () => {
    existingPlaceCount = PLAN_LIMITS.free.places - 1;
    const { createPlace } = await repository();

    await expect(createPlace(ctx, MAP_ID, placeInput("Shop"))).resolves.toMatchObject({
      name: "Shop",
    });
    expect(createRow).toHaveBeenCalledOnce();
  });

  it("refuses the place that would exceed the limit", async () => {
    existingPlaceCount = PLAN_LIMITS.free.places;
    const { createPlace } = await repository();

    await expect(createPlace(ctx, MAP_ID, placeInput("Shop"))).rejects.toMatchObject({
      code: "plan_limit_reached",
      status: 403,
    });
    // The important half: nothing was written.
    expect(createRow).not.toHaveBeenCalled();
  });

  it("uses the paid limit for an active paid subscription", async () => {
    subscriptionRows = [{ plan: "starter", status: "active" }];
    existingPlaceCount = PLAN_LIMITS.free.places + 5;
    const { createPlace } = await repository();

    await expect(createPlace(ctx, MAP_ID, placeInput("Shop"))).resolves.toBeTruthy();
  });

  it("falls back to the free limit when a subscription is not active", async () => {
    subscriptionRows = [{ plan: "pro", status: "past_due" }];
    existingPlaceCount = PLAN_LIMITS.free.places;
    const { createPlace } = await repository();

    await expect(createPlace(ctx, MAP_ID, placeInput("Shop"))).rejects.toMatchObject({
      code: "plan_limit_reached",
    });
  });
});

describe("createPlaces", () => {
  it("counts the whole batch against the limit, not one row at a time", async () => {
    // 8 used, 2 left, 5 incoming. Row-by-row checking would save 2 and fail the
    // rest, leaving a half-imported map.
    existingPlaceCount = PLAN_LIMITS.free.places - 2;
    const { createPlaces } = await repository();

    await expect(
      createPlaces(ctx, MAP_ID, [
        placeInput("A"),
        placeInput("B"),
        placeInput("C"),
        placeInput("D"),
        placeInput("E"),
      ]),
    ).rejects.toMatchObject({ code: "plan_limit_reached" });

    expect(createRows).not.toHaveBeenCalled();
  });

  it("imports a batch that exactly fills the plan", async () => {
    existingPlaceCount = PLAN_LIMITS.free.places - 2;
    const { createPlaces } = await repository();

    const places = await createPlaces(ctx, MAP_ID, [placeInput("A"), placeInput("B")]);

    expect(places).toHaveLength(2);
    expect(createRows).toHaveBeenCalledOnce();
  });

  it("continues each row's sortOrder from the existing count", async () => {
    existingPlaceCount = 3;
    const { createPlaces } = await repository();

    await createPlaces(ctx, MAP_ID, [placeInput("A"), placeInput("B")]);

    const { rows } = createRows.mock.calls[0][0];
    expect(rows.map((row: { sortOrder: number }) => row.sortOrder)).toEqual([3, 4]);
  });

  it("gives every bulk row owner permissions", async () => {
    const { createPlaces } = await repository();

    await createPlaces(ctx, MAP_ID, [placeInput("A")]);

    const { rows } = createRows.mock.calls[0][0];
    // Bulk create takes permissions per row; without them the rows land ownerless.
    expect(rows[0].$permissions).toEqual(
      expect.arrayContaining([`read("user:${USER_ID}")`]),
    );
    expect(rows[0].$id).toBeTruthy();
  });

  it("writes nothing for an empty batch", async () => {
    const { createPlaces } = await repository();

    await expect(createPlaces(ctx, MAP_ID, [])).resolves.toEqual([]);
    expect(createRows).not.toHaveBeenCalled();
  });
});
