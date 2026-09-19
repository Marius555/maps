import { describe, expect, it, vi } from "vitest";

import { MARKETING_PLANS, RECOMMENDED_PLAN } from "./plans";

/*
 * `plan-limits.ts` reaches the admin Appwrite client at module load, which
 * wants real environment variables. Stubbed the same way
 * `lib/repositories/plan-limits.test.ts` stubs it — the tables under test are
 * plain constants in that module, and nothing here calls a repository.
 */
vi.mock("@/lib/env", () => ({
  env: {
    appwriteApiKey: "test-key",
    databaseId: "test-db",
    storageId: "test-store",
  },
}));

vi.mock("@/lib/appwrite/admin", () => ({ admin: { tablesDB: {} } }));

const { PLAN_FEATURES, PLAN_LIMITS } = await import(
  "@/lib/repositories/plan-limits"
);
type PlanId = keyof typeof PLAN_LIMITS;

/**
 * The landing page states the plans; the repositories enforce them. This is the
 * seam, and it is the only thing stopping the page promising 500 locations on a
 * plan that refuses the 301st.
 *
 * `server-only` is aliased to a stub in vitest.config.mts, which is what lets a
 * test import the real server table rather than a copy of it. Comparing the page
 * against another copy would test nothing.
 */
describe("marketing plans", () => {
  it("names every plan the product has, and no others", () => {
    expect(MARKETING_PLANS.map((plan) => plan.id)).toEqual(
      Object.keys(PLAN_LIMITS) as PlanId[],
    );
  });

  it.each(MARKETING_PLANS)("quotes $id's real limits", (plan) => {
    expect({
      maps: plan.maps,
      places: plan.places,
      shapes: plan.shapes,
    }).toEqual(PLAN_LIMITS[plan.id]);
  });

  it.each(MARKETING_PLANS)("quotes $id's real features", (plan) => {
    expect({ routes: plan.routes, sheetSync: plan.sheetSync }).toEqual(
      PLAN_FEATURES[plan.id],
    );
  });

  it.each(MARKETING_PLANS)("prints $id's price as the amount it charts", (plan) => {
    expect(plan.price).toBe(`€${plan.amount}`);
  });

  it("recommends a plan that exists", () => {
    expect(MARKETING_PLANS.map((plan) => plan.id)).toContain(RECOMMENDED_PLAN);
  });
});
