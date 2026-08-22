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
/** How many shapes the map already has. Set per test. */
let existingShapeCount = 0;
/** The row `plan-limits` reads. Empty array means the free plan. */
let subscriptionRows: { plan?: string; status?: string }[] = [];

beforeEach(() => {
  vi.clearAllMocks();
  vi.resetModules();

  existingPlaceCount = 0;
  existingShapeCount = 0;
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

  // The subscription read and both entity counts go through listRows, so the
  // mock branches on which table was asked for.
  listRows.mockImplementation(async ({ tableId }: { tableId: string }) => {
    if (tableId === "subscriptions") {
      return { rows: subscriptionRows, total: subscriptionRows.length };
    }

    if (tableId === "shapes") return { rows: [], total: existingShapeCount };

    return { rows: [], total: existingPlaceCount };
  });

  createRow.mockImplementation(async ({ data }: { data: Record<string, unknown> }) => ({
    $id: "row-new",
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
  tags: [],
  fields: {},
  icon: "",
  sortOrder: 0,
  geocodeStatus: "manual" as const,
  groupId: "",
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

describe("createShape", () => {
  const shapeInput = (name: string) => ({
    name,
    geometry: { kind: "circle" as const, lng: 25.28, lat: 54.687, radius: 800 },
    color: "#1c7ed6",
    opacity: 0.2,
    sortOrder: 0,
    groupId: "",
  });

  async function shapes() {
    return import("./shapes.repository");
  }

  it("allows a shape below the free plan's limit", async () => {
    existingShapeCount = PLAN_LIMITS.free.shapes - 1;
    const { createShape } = await shapes();

    await expect(createShape(ctx, MAP_ID, shapeInput("Zone"))).resolves.toMatchObject({
      name: "Zone",
    });
    expect(createRow).toHaveBeenCalledOnce();
  });

  it("refuses the shape that would exceed the limit", async () => {
    existingShapeCount = PLAN_LIMITS.free.shapes;
    const { createShape } = await shapes();

    await expect(createShape(ctx, MAP_ID, shapeInput("Zone"))).rejects.toMatchObject({
      code: "plan_limit_reached",
      status: 403,
    });
    expect(createRow).not.toHaveBeenCalled();
  });

  it("counts shapes against the shape limit, not the place one", async () => {
    // A map full of locations must not block a first shape, and vice versa.
    existingPlaceCount = PLAN_LIMITS.free.places;
    existingShapeCount = 0;
    const { createShape } = await shapes();

    await expect(createShape(ctx, MAP_ID, shapeInput("Zone"))).resolves.toBeTruthy();
  });

  it("splits the geometry into a kind column and a payload", async () => {
    const { createShape } = await shapes();

    await createShape(ctx, MAP_ID, shapeInput("Zone"));

    const { data } = createRow.mock.calls[0][0];
    expect(data.kind).toBe("circle");
    // The kind is not repeated inside the payload — one discriminator, no second
    // copy to disagree with it.
    expect(JSON.parse(data.geometry)).toEqual({
      lng: 25.28,
      lat: 54.687,
      radius: 800,
    });
  });

  it("uses the paid limit for an active paid subscription", async () => {
    subscriptionRows = [{ plan: "starter", status: "active" }];
    existingShapeCount = PLAN_LIMITS.free.shapes + 5;
    const { createShape } = await shapes();

    await expect(createShape(ctx, MAP_ID, shapeInput("Zone"))).resolves.toBeTruthy();
  });
});

/**
 * The importer's paywall.
 *
 * The case `createShape` cannot cover: a GeoJSON file arrives as one batch, and
 * checking the limit per row would let a thirteen-province import stop at the
 * third with three provinces already saved and no way to tell the user which.
 * The batch is refused whole or written whole.
 */
describe("createShapes", () => {
  const shapeInput = (name: string) => ({
    name,
    geometry: {
      kind: "polygon" as const,
      points: [
        [25.27, 54.68],
        [25.29, 54.68],
        [25.28, 54.7],
      ] as [number, number][],
    },
    color: "#1c7ed6",
    opacity: 0.2,
    sortOrder: 0,
    groupId: "",
  });

  const batch = (count: number) =>
    Array.from({ length: count }, (_, index) => shapeInput(`Region ${index}`));

  async function shapes() {
    return import("./shapes.repository");
  }

  it("writes a batch that fits", async () => {
    existingShapeCount = 0;
    const { createShapes } = await shapes();

    const created = await createShapes(ctx, MAP_ID, batch(PLAN_LIMITS.free.shapes));

    expect(created).toHaveLength(PLAN_LIMITS.free.shapes);
    expect(createRows).toHaveBeenCalledOnce();
  });

  it("refuses a batch that would overflow, and writes nothing", async () => {
    existingShapeCount = 0;
    const { createShapes } = await shapes();

    await expect(
      createShapes(ctx, MAP_ID, batch(PLAN_LIMITS.free.shapes + 1)),
    ).rejects.toMatchObject({ code: "plan_limit_reached", status: 403 });

    // The half that matters. A partial import is worse than a refused one,
    // because the user cannot tell what landed.
    expect(createRows).not.toHaveBeenCalled();
  });

  it("counts what the map already holds", async () => {
    existingShapeCount = PLAN_LIMITS.free.shapes - 1;
    const { createShapes } = await shapes();

    // One fits, two do not — the limit is on the total, not on the batch.
    await expect(createShapes(ctx, MAP_ID, batch(1))).resolves.toHaveLength(1);
    await expect(createShapes(ctx, MAP_ID, batch(2))).rejects.toMatchObject({
      code: "plan_limit_reached",
    });
  });

  it("uses the paid limit for an active paid subscription", async () => {
    subscriptionRows = [{ plan: "starter", status: "active" }];
    existingShapeCount = 0;
    const { createShapes } = await shapes();

    await expect(
      createShapes(ctx, MAP_ID, batch(PLAN_LIMITS.free.shapes + 5)),
    ).resolves.toBeTruthy();
  });

  it("writes nothing for an empty batch", async () => {
    const { createShapes } = await shapes();

    await expect(createShapes(ctx, MAP_ID, [])).resolves.toEqual([]);
    expect(createRows).not.toHaveBeenCalled();
  });

  it("numbers sortOrder on from what the map already has", async () => {
    existingShapeCount = 2;
    subscriptionRows = [{ plan: "starter", status: "active" }];
    const { createShapes } = await shapes();

    await createShapes(ctx, MAP_ID, batch(3));

    const { rows } = createRows.mock.calls[0][0];
    expect(rows.map((row: { sortOrder: number }) => row.sortOrder)).toEqual([2, 3, 4]);
  });

  it("splits the kind out of the geometry, as createShape does", async () => {
    subscriptionRows = [{ plan: "starter", status: "active" }];
    const { createShapes } = await shapes();

    await createShapes(ctx, MAP_ID, batch(1));

    const { rows } = createRows.mock.calls[0][0];
    expect(rows[0].kind).toBe("polygon");
    expect(JSON.parse(rows[0].geometry)).not.toHaveProperty("kind");
  });
});
