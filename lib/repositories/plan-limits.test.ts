import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  planFeatureMessage,
  planFeatureNote,
  planLimitMessage,
  planLimitUsage,
  publishOverLimitMessage,
} from "./errors";
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
const deleteRow = vi.fn();
const deleteRows = vi.fn();

vi.mock("@/lib/appwrite/admin", () => ({
  admin: {
    tablesDB: {
      listRows: (...args: unknown[]) => listRows(...args),
      getRow: (...args: unknown[]) => getRow(...args),
      createRow: (...args: unknown[]) => createRow(...args),
      createRows: (...args: unknown[]) => createRows(...args),
      deleteRow: (...args: unknown[]) => deleteRow(...args),
      deleteRows: (...args: unknown[]) => deleteRows(...args),
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
/**
 * Rows another request inserted at the same moment — counted only once this
 * test's own insert has happened, which is what a race looks like from inside
 * one request: the pre-check saw the map without them, the recount sees them.
 */
let racingRows = 0;
/** What this test has inserted so far, per table, so a recount includes it. */
let inserted = { places: 0, shapes: 0 };
/** The row `plan-limits` reads. Empty array means the free plan. */
let subscriptionRows: {
  plan?: string;
  status?: string;
  currentPeriodEnd?: string;
  keptPlan?: string;
  keptUntil?: string;
}[] = [];

beforeEach(() => {
  vi.clearAllMocks();
  vi.resetModules();

  existingPlaceCount = 0;
  existingShapeCount = 0;
  racingRows = 0;
  inserted = { places: 0, shapes: 0 };
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

    const table = tableId === "shapes" ? "shapes" : "places";
    const existing = table === "shapes" ? existingShapeCount : existingPlaceCount;
    const racers = inserted[table] > 0 ? racingRows : 0;

    return { rows: [], total: existing + inserted[table] + racers };
  });

  createRow.mockImplementation(
    async ({ tableId, data }: { tableId: string; data: Record<string, unknown> }) => {
      inserted[tableId === "shapes" ? "shapes" : "places"] += 1;

      return {
        $id: "row-new",
        $createdAt: "2026-01-01T00:00:00.000Z",
        $updatedAt: "2026-01-01T00:00:00.000Z",
        ...data,
      };
    },
  );

  createRows.mockImplementation(
    async ({ tableId, rows }: { tableId: string; rows: Record<string, unknown>[] }) => {
      inserted[tableId === "shapes" ? "shapes" : "places"] += rows.length;

      return {
      rows: rows.map((row, index) => ({
        $createdAt: "2026-01-01T00:00:00.000Z",
        $updatedAt: "2026-01-01T00:00:00.000Z",
        ...row,
        $id: `place-${index}`,
      })),
      total: rows.length,
      };
    },
  );
});

async function repository() {
  return import("./places.repository");
}

async function planLimits() {
  return import("./plan-limits");
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

  it("removes the place it just made when a racing request took the last slot", async () => {
    existingPlaceCount = PLAN_LIMITS.free.places - 1;
    racingRows = 1;
    const { createPlace } = await repository();

    await expect(createPlace(ctx, MAP_ID, placeInput("Shop"))).rejects.toMatchObject({
      code: "plan_limit_reached",
    });
    expect(deleteRows).toHaveBeenCalledOnce();
    expect(JSON.stringify(deleteRows.mock.calls[0][0].queries)).toContain("row-new");
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

  /*
   * The opposite of what this test used to assert. The session cookie is the
   * Appwrite session secret, so any permission a row grants its owner is one
   * they can exercise straight through Appwrite's API, past every check here —
   * `update` on a place was a way to move it to another map. Every access goes
   * through the admin client, so a row needs none.
   */
  it("gives bulk rows no permissions, so no owner can edit them past this code", async () => {
    const { createPlaces } = await repository();

    await createPlaces(ctx, MAP_ID, [placeInput("A")]);

    const { rows } = createRows.mock.calls[0][0];
    expect(rows[0].$permissions).toEqual([]);
    expect(rows[0].$id).toBeTruthy();
  });

  /*
   * Two imports landing together both count the same number and both pass. The
   * recount after the insert is what stops them: whichever sees the map past the
   * limit removes every row it just wrote and refuses.
   */
  it("removes its own rows when a racing request pushed the map past the limit", async () => {
    existingPlaceCount = PLAN_LIMITS.free.places - 2;
    racingRows = 2;
    const { createPlaces } = await repository();

    await expect(
      createPlaces(ctx, MAP_ID, [placeInput("A"), placeInput("B")]),
    ).rejects.toMatchObject({ code: "plan_limit_reached", status: 403 });

    expect(deleteRows).toHaveBeenCalledOnce();
    const { queries } = deleteRows.mock.calls[0][0];
    expect(JSON.stringify(queries)).toContain("place-0");
    expect(JSON.stringify(queries)).toContain("place-1");
  });

  it("keeps its rows when the recount is still within the limit", async () => {
    existingPlaceCount = PLAN_LIMITS.free.places - 4;
    racingRows = 2;
    const { createPlaces } = await repository();

    await expect(
      createPlaces(ctx, MAP_ID, [placeInput("A"), placeInput("B")]),
    ).resolves.toHaveLength(2);
    expect(deleteRows).not.toHaveBeenCalled();
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

  /*
   * A route is stored as a line carrying a `route` field. The routing endpoints
   * check the plan, but a free account could otherwise post a route it computed
   * itself and publish it.
   */
  const routeInput = {
    name: "Delivery",
    geometry: {
      kind: "line" as const,
      points: [
        [25.28, 54.687],
        [25.3, 54.69],
      ] as [number, number][],
      route: {
        profile: "car" as const,
        stops: [{ at: [25.28, 54.687] as [number, number] }, { at: [25.3, 54.69] as [number, number] }],
        durationS: 300,
      },
    },
    color: "#1c7ed6",
    opacity: 1,
    sortOrder: 0,
    groupId: "",
  };

  it("refuses a route on the free plan", async () => {
    const { createShape } = await shapes();

    await expect(createShape(ctx, MAP_ID, routeInput)).rejects.toMatchObject({
      code: "plan_feature_required",
    });
    expect(createRow).not.toHaveBeenCalled();
  });

  it("saves a route on a plan that has them", async () => {
    subscriptionRows = [{ plan: "starter", status: "active" }];
    const { createShape } = await shapes();

    await expect(createShape(ctx, MAP_ID, routeInput)).resolves.toBeTruthy();
  });

  it("saves a plain line on the free plan", async () => {
    const { createShape } = await shapes();
    const { route: _route, ...line } = routeInput.geometry;
    void _route;

    await expect(
      createShape(ctx, MAP_ID, { ...routeInput, geometry: line }),
    ).resolves.toBeTruthy();
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

describe("publishOverLimitMessage", () => {
  it("says how many to remove, and the other way out", () => {
    expect(publishOverLimitMessage("places", 40, 25, "free")).toBe(
      "This map has 40 locations and the free plan publishes up to 25. Remove 15 locations or upgrade to publish it.",
    );
    expect(publishOverLimitMessage("shapes", 4, 3, "free")).toContain("Remove 1 shape or");
  });

  it("names which maps still publish when there are too many", () => {
    expect(publishOverLimitMessage("maps", 0, 1, "free")).toBe(
      "The free plan publishes your first map, and this one comes after. Delete an older map or upgrade to publish it.",
    );
  });
});

describe("planLimitMessage", () => {
  /*
   * The refusal and the pre-emptive warning under the pin grid are one sentence
   * cut in half — `planLimitUsage` is the half the menu shows (see
   * lib/map/plan-headroom.ts). Nothing else holds them together, so if the
   * composers are ever edited apart this is where it shows up rather than as two
   * screens quietly disagreeing about the same ceiling.
   */
  it("opens with the warning's own words", () => {
    const full = planLimitMessage("places", 10, "free");

    expect(full.startsWith(planLimitUsage("places", 10, "free"))).toBe(true);
  });

  it("adds the two ways out, which the toast is what carries", () => {
    expect(planLimitMessage("shapes", 3, "free")).toBe(
      "You've used all 3 shapes included on the free plan. " +
        "Delete a shape to add another, or upgrade for more.",
    );
  });

  it("says one map rather than all 1 maps", () => {
    // The free plan's map allowance is the only limit that is ever 1.
    expect(planLimitUsage("maps", 1, "free")).toBe(
      "You've used 1 map included on the free plan.",
    );
  });
});

/*
 * The guard the geocode batch route leans on, which is why it is tested apart
 * from the inserts that also use it.
 *
 * It matters more at the geocoder than at the insert: geocoding spends requests
 * against a shared upstream whose policy bans extensive use, and until this was
 * hoisted out of `createPlaces` the only ceiling was reached *after* all of them
 * had been spent. A regression here is not a wrong number on a screen, it is a
 * free account walking a 500-row CSV through somebody else's rate limit.
 */
describe("assertPlaceHeadroom", () => {
  it("allows a batch that fits, and reports the count it read", async () => {
    existingPlaceCount = PLAN_LIMITS.free.places - 4;
    const { assertPlaceHeadroom } = await repository();

    await expect(assertPlaceHeadroom(ctx, MAP_ID, 4)).resolves.toBe(
      PLAN_LIMITS.free.places - 4,
    );
  });

  it("refuses a batch that would overflow", async () => {
    existingPlaceCount = PLAN_LIMITS.free.places - 4;
    const { assertPlaceHeadroom } = await repository();

    await expect(assertPlaceHeadroom(ctx, MAP_ID, 5)).rejects.toMatchObject({
      code: "plan_limit_reached",
      status: 403,
    });
  });

  it("refuses a single row once the map is already full", async () => {
    existingPlaceCount = PLAN_LIMITS.free.places;
    const { assertPlaceHeadroom } = await repository();

    await expect(assertPlaceHeadroom(ctx, MAP_ID, 1)).rejects.toMatchObject({
      code: "plan_limit_reached",
    });
  });

  it("uses the paid ceiling for an active subscription", async () => {
    subscriptionRows = [{ plan: "pro", status: "active" }];
    existingPlaceCount = PLAN_LIMITS.starter.places;
    const { assertPlaceHeadroom } = await repository();

    await expect(assertPlaceHeadroom(ctx, MAP_ID, 100)).resolves.toBe(
      PLAN_LIMITS.starter.places,
    );
  });
});

/*
 * Routes are the one feature whose cost has no quantity ceiling in front of it:
 * a map with three pins can be rerouted all afternoon, and arming the tool
 * probes every pin besides. If this regresses, a free account spends requests
 * on a routing engine we pay for.
 */
describe("assertPlanFeature", () => {
  it("refuses routes on the free plan", async () => {
    const { assertPlanFeature } = await planLimits();

    await expect(assertPlanFeature(USER_ID, "routes")).rejects.toMatchObject({
      code: "plan_feature_required",
      status: 403,
    });
  });

  it("allows routes on an active paid plan", async () => {
    subscriptionRows = [{ plan: "starter", status: "active" }];
    const { assertPlanFeature } = await planLimits();

    await expect(assertPlanFeature(USER_ID, "routes")).resolves.toBeUndefined();
  });

  it("falls back to free when the subscription has lapsed", async () => {
    subscriptionRows = [{ plan: "pro", status: "past_due" }];
    const { assertPlanFeature } = await planLimits();

    await expect(assertPlanFeature(USER_ID, "routes")).rejects.toMatchObject({
      code: "plan_feature_required",
    });
  });

  /*
   * Sheet sync re-reads a sheet daily and geocodes what changed, with nobody
   * pressing anything. A free account that slipped through would spend credits
   * every night for as long as the link existed.
   */
  it("refuses sheet sync on the free plan and allows it on starter", async () => {
    const { assertPlanFeature } = await planLimits();

    await expect(assertPlanFeature(USER_ID, "sheetSync")).rejects.toMatchObject({
      code: "plan_feature_required",
    });

    subscriptionRows = [{ plan: "starter", status: "active" }];
    const fresh = await planLimits();

    await expect(fresh.assertPlanFeature(USER_ID, "sheetSync")).resolves.toBeUndefined();
  });

  // The account menu greys Contact support on Free; this is the check that
  // holds when somebody posts to the route anyway.
  it("refuses contact support on the free plan and allows it on starter", async () => {
    const { assertPlanFeature } = await planLimits();

    await expect(assertPlanFeature(USER_ID, "support")).rejects.toMatchObject({
      code: "plan_feature_required",
    });

    subscriptionRows = [{ plan: "starter", status: "active" }];
    const fresh = await planLimits();

    await expect(fresh.assertPlanFeature(USER_ID, "support")).resolves.toBeUndefined();
  });

  it("has a row for every plan the limits table knows", async () => {
    // The `satisfies` on PLAN_FEATURES makes a missing plan a type error, but
    // only while both tables are edited in the same commit. Said out loud here
    // because the failure it prevents is silent: a new plan defaulting to false
    // is a paid feature switched off for the people paying for it.
    const { PLAN_FEATURES } = await planLimits();

    expect(Object.keys(PLAN_FEATURES).sort()).toEqual(
      Object.keys(PLAN_LIMITS).sort(),
    );
  });
});

describe("getUserPlan and the end of a paid period", () => {
  /*
   * Two conditions decide a plan — the status the webhook wrote, and the date it
   * wrote beside it — and the second exists because the first is not enough.
   *
   * A cancellation does not end access: the provider keeps a cancelled
   * subscription running to the end of the period already paid for, so the
   * webhook stores `active` with an end date and *expects a later event* to close
   * it. If that event is dropped, retried into a failure or never sent, the row
   * sits at `active` for ever and the account keeps a plan it stopped paying for.
   * Reading the date here means the worst a lost webhook can do is expire
   * somebody slightly early, which they can see and we can fix.
   */

  it("keeps a plan that is active and has not reached its end date", async () => {
    subscriptionRows = [
      { plan: "pro", status: "active", currentPeriodEnd: "2099-01-01T00:00:00.000Z" },
    ];
    const { getUserPlan } = await planLimits();

    await expect(getUserPlan(USER_ID)).resolves.toBe("pro");
  });

  it("drops to free once the paid period has passed", async () => {
    subscriptionRows = [
      { plan: "pro", status: "active", currentPeriodEnd: "2020-01-01T00:00:00.000Z" },
    ];
    const { getUserPlan } = await planLimits();

    await expect(getUserPlan(USER_ID)).resolves.toBe("free");
  });

  it("keeps the plan when no end date is known", async () => {
    // Absent has to go on meaning what it meant before the column was used, or
    // every row written before this check would expire the moment it shipped.
    subscriptionRows = [{ plan: "starter", status: "active" }];
    const { getUserPlan } = await planLimits();

    await expect(getUserPlan(USER_ID)).resolves.toBe("starter");
  });

  it("keeps a downgraded account on the plan it paid for until the renewal", async () => {
    // The provider already bills Starter; Pro was paid for until 2099.
    subscriptionRows = [
      {
        plan: "starter",
        status: "active",
        currentPeriodEnd: "2099-01-01T00:00:00.000Z",
        keptPlan: "pro",
        keptUntil: "2099-01-01T00:00:00.000Z",
      },
    ];
    const { getUserPlan } = await planLimits();

    await expect(getUserPlan(USER_ID)).resolves.toBe("pro");
  });

  it("moves a downgraded account to the plan it is billed for once the renewal passes", async () => {
    subscriptionRows = [
      {
        plan: "starter",
        status: "active",
        currentPeriodEnd: "2099-01-01T00:00:00.000Z",
        keptPlan: "pro",
        keptUntil: "2020-01-01T00:00:00.000Z",
      },
    ];
    const { getUserPlan } = await planLimits();

    await expect(getUserPlan(USER_ID)).resolves.toBe("starter");
  });

  it("keeps the plan when the date cannot be read at all", async () => {
    // Fails towards the customer, deliberately: a value we cannot parse must not
    // lock somebody out of what they are paying for.
    subscriptionRows = [
      { plan: "starter", status: "active", currentPeriodEnd: "not a date" },
    ];
    const { getUserPlan } = await planLimits();

    await expect(getUserPlan(USER_ID)).resolves.toBe("starter");
  });
});

describe("planFeatureMessage", () => {
  /* The same split `planLimitMessage` is held to above: the menu shows the
     first half, the 403 carries the whole thing, and one composer builds both
     so a greyed row and the refusal behind it cannot word the gate two ways. */
  it("opens with the note the Draw menu shows", () => {
    const full = planFeatureMessage("routes", "free");

    expect(full.startsWith(planFeatureNote("routes", "free"))).toBe(true);
  });

  it("names the one way out, which is the plan and not a delete", () => {
    expect(planFeatureMessage("routes", "free")).toBe(
      "Routes aren't included on the free plan. Upgrade to draw them.",
    );
    expect(planFeatureMessage("sheetSync", "free")).toBe(
      "Linked Google Sheets aren't included on the free plan. Upgrade to keep this map in sync with a sheet.",
    );
  });
});

describe("DISABLE_ALL_PLAN", () => {
  /*
   * A temporary testing switch, tested because it is the paywall it switches
   * off. What matters is the default: the flag is read at call time, so a stray
   * value in a shell would change behaviour with no deploy, and "absent means
   * enforced" is the only property here worth a regression test.
   */

  beforeEach(() => {
    vi.spyOn(console, "warn").mockImplementation(() => {});
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("reads every account as pro, without asking Appwrite at all", async () => {
    vi.stubEnv("DISABLE_ALL_PLAN", "1");
    const { getUserPlan } = await planLimits();

    await expect(getUserPlan(USER_ID)).resolves.toBe("pro");
    expect(listRows).not.toHaveBeenCalled();
  });

  it("opens the gate the free plan closes", async () => {
    vi.stubEnv("DISABLE_ALL_PLAN", "true");
    const { assertPlanFeature } = await planLimits();

    await expect(assertPlanFeature(USER_ID, "routes")).resolves.toBeUndefined();
  });

  it("says so, once, rather than bypassing the paywall silently", async () => {
    vi.stubEnv("DISABLE_ALL_PLAN", "yes");
    const { getUserPlan } = await planLimits();

    await getUserPlan("user-a");
    await getUserPlan("user-b");

    expect(console.warn).toHaveBeenCalledTimes(1);
    expect(vi.mocked(console.warn).mock.calls[0]?.[0]).toContain("DISABLE_ALL_PLAN");
  });

  it("stays shut for anything that is not an affirmative", async () => {
    for (const value of ["", "0", "false", "no", "maybe"]) {
      vi.resetModules();
      vi.stubEnv("DISABLE_ALL_PLAN", value);
      const { getUserPlan } = await planLimits();

      await expect(getUserPlan(USER_ID)).resolves.toBe("free");
    }
  });

  /*
   * The property the whole switch now rests on. It used to be marked "delete this
   * before it is in front of anyone", which is a plan rather than a guarantee —
   * and this is a paywall bypass configured by an environment variable, on a host
   * where setting one is a form field and a redeploy.
   */
  it("is inert in a production build whatever it is set to", async () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("DISABLE_ALL_PLAN", "1");
    const { getUserPlan, assertPlanFeature } = await planLimits();

    await expect(getUserPlan(USER_ID)).resolves.toBe("free");
    await expect(assertPlanFeature(USER_ID, "routes")).rejects.toMatchObject({
      code: "plan_feature_required",
    });
  });

  it("stays shut when it is not set at all", async () => {
    vi.stubEnv("DISABLE_ALL_PLAN", undefined);
    const { assertPlanFeature } = await planLimits();

    await expect(assertPlanFeature(USER_ID, "routes")).rejects.toMatchObject({
      code: "plan_feature_required",
    });
  });
});
