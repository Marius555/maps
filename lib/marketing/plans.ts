/**
 * The plans, as a page may state them.
 *
 * **A second table, on purpose.** `lib/repositories/plan-limits.ts` is the one
 * that decides anything — it is `import "server-only"`, because CLAUDE.md §6
 * says limits are enforced in the repositories and never only in the UI — and a
 * marketing page that imported it would drag the admin Appwrite client and the
 * whole server graph into a statically rendered page, or fail the build trying.
 *
 * So this is the same numbers written down for reading rather than for
 * enforcing, and `plans.test.ts` asserts the two agree on every one of them. A
 * price that disagrees with the product is a refund; a number here that
 * disagrees with `PLAN_LIMITS` is a promise the repositories will refuse to
 * keep, which is worse. The test is what makes the duplication safe.
 *
 * Prices are the ones in CLAUDE.md §6 and are not yet charged: billing is still
 * owed. Nothing on the page claims otherwise — every button goes to signup.
 */

export type MarketingPlan = {
  id: "free" | "starter" | "pro";
  name: string;
  /** Written out for the card, where "€19" is how a person reads a price. */
  price: string;
  /**
   * The same price as a number, in euros a month — what the cost calculator
   * draws a bar from. `plans.test.ts` holds it to `price`, so the two can never
   * say different things.
   */
  amount: number;
  cadence?: string;
  pitch: string;
  maps: number;
  places: number;
  shapes: number;
  routes: boolean;
  sheetSync: boolean;
  /** The one line that is different about this plan, said in the plan's terms. */
  highlight: string;
};

export const MARKETING_PLANS: MarketingPlan[] = [
  {
    id: "free",
    name: "Free",
    price: "€0",
    amount: 0,
    pitch: "Enough to put a real map on a real site and see it work.",
    maps: 1,
    places: 10,
    shapes: 3,
    routes: false,
    sheetSync: false,
    highlight: "No card, no trial clock.",
  },
  {
    id: "starter",
    name: "Starter",
    price: "€19",
    amount: 19,
    cadence: "a month",
    pitch: "A single brand with a few hundred stockists, dealers or venues.",
    maps: 3,
    places: 300,
    shapes: 50,
    routes: true,
    sheetSync: true,
    highlight: "Keep a map in step with a Google Sheet.",
  },
  {
    id: "pro",
    name: "Pro",
    price: "€39",
    amount: 39,
    cadence: "a month",
    pitch: "Several maps, several markets, and a list that keeps growing.",
    maps: 15,
    places: 3000,
    shapes: 250,
    routes: true,
    sheetSync: true,
    highlight: "Three thousand locations on one map.",
  },
];

/** Which plan the page leads with. Not the dearest — the one most people need. */
export const RECOMMENDED_PLAN = "starter";
