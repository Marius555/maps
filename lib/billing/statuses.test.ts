import { describe, expect, it } from "vitest";

import { SUBSCRIPTION_STATUSES as SCHEMA_STATUSES, PLANS } from "@/scripts/appwrite-schema.mjs";
import { MARKETING_PLANS } from "@/lib/marketing/plans";
import { SUBSCRIPTION_STATUSES } from "./types";

/**
 * The seam between the TypeScript vocabulary and the database's own enum.
 *
 * `scripts/appwrite-schema.mjs` is plain JavaScript and cannot import a type, so
 * its `SUBSCRIPTION_STATUSES` and `PLANS` are hand-copied — the same arrangement
 * `SHAPE_KINDS` has, and the same hazard. The failure it guards against is
 * specific and silent: a status this code maps to but the column does not allow
 * makes Appwrite reject the write, so the *webhook* fails, so the provider retries
 * it, so a customer who has paid never gets their plan and nothing in the app says
 * why.
 */

describe("subscription statuses", () => {
  it("are exactly the ones the column accepts", () => {
    expect([...SUBSCRIPTION_STATUSES].sort()).toEqual(
      [...(SCHEMA_STATUSES as string[])].sort(),
    );
  });
});

describe("plans", () => {
  it("are exactly the ones the column accepts", () => {
    // The third copy of the plan list, after `PLAN_LIMITS` and `MARKETING_PLANS`
    // — `lib/marketing/plans.test.ts` holds those two together, and this holds
    // the database to them.
    expect(MARKETING_PLANS.map((plan) => plan.id).sort()).toEqual(
      [...(PLANS as string[])].sort(),
    );
  });
});
