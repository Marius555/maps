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
 * Prices are the ones in CLAUDE.md §6, and they are now charged. The cards link
 * to `/upgrade`, which reads the session and opens the merchant of record's
 * checkout; this module still knows nothing about any of that, which is what
 * keeps `/pricing` statically rendered.
 *
 * **What is here is what a page may say, and the provider is what actually
 * charges.** A price in this file that disagrees with the variant configured in
 * `LEMON_VARIANT_*` is an advertisement we do not honour, and no test can catch
 * it — the two live in different systems. Change one, change the other, in the
 * same sitting.
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
  /**
   * A year up front, and the discount is stated as *two months free* rather than
   * as a percentage, because that is the thing being offered and "17% off" is the
   * arithmetic of it. Absent on Free, which has no year to buy.
   *
   * It is not only a discount. The merchant of record charges a fixed 50¢ plus a
   * half-point surcharge on every subscription *renewal*, so twelve charges a year
   * cost meaningfully more to collect than one — the discount is partly funded by
   * the fee it avoids, and the rest buys a year of not churning.
   */
  priceYearly?: string;
  amountYearly?: number;
  pitch: string;
  maps: number;
  places: number;
  shapes: number;
  /**
   * Addresses this plan may turn into coordinates in a month.
   *
   * On the card because a ceiling a customer can hit is a ceiling a customer is
   * owed the number of. It is the one limit here that is not about what they
   * build, which is why the page explains it in a sentence rather than listing it
   * as another quantity.
   */
  lookups: number;
  routes: boolean;
  sheetSync: boolean;
  analytics: boolean;
  /** Publishes without the "Made with" badge. */
  noBadge: boolean;
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
    places: 25,
    shapes: 3,
    lookups: 250,
    routes: false,
    sheetSync: false,
    analytics: false,
    noBadge: false,
    highlight: "No card, no trial clock.",
  },
  {
    id: "starter",
    name: "Starter",
    price: "€19",
    amount: 19,
    cadence: "a month",
    priceYearly: "€190",
    amountYearly: 190,
    pitch: "A single brand with a few hundred stockists, dealers or venues.",
    maps: 3,
    places: 300,
    shapes: 50,
    lookups: 4000,
    routes: true,
    sheetSync: true,
    analytics: true,
    noBadge: true,
    highlight: "Keep a map in step with a Google Sheet.",
  },
  {
    id: "pro",
    name: "Pro",
    price: "€39",
    amount: 39,
    cadence: "a month",
    priceYearly: "€390",
    amountYearly: 390,
    pitch: "Several maps, several markets, and a list that keeps growing.",
    maps: 15,
    places: 3000,
    shapes: 250,
    lookups: 50000,
    routes: true,
    sheetSync: true,
    analytics: true,
    noBadge: true,
    highlight: "Three thousand locations on one map.",
  },
];

/** How many months a year costs. Two free, stated as the discount itself. */
export const YEARLY_MONTHS = 10;

/** Which cadence a price is for. The checkout and the card both speak in these. */
export type PlanCadence = "monthly" | "yearly";

/** Which plan the page leads with. Not the dearest — the one most people need. */
export const RECOMMENDED_PLAN = "starter";
