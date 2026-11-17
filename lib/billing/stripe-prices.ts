import "server-only";

import { BillingError, call, type Stripe } from "./stripe-client";
import type { BillingCadence, PaidPlanId, PlanOffer } from "./types";

/**
 * Our four plans ↔ Stripe's prices, by **lookup key**.
 *
 * A price is found by the key `npm run setup:stripe` gave it, never by an id
 * pasted into the environment. The Lemon Squeezy integration configured four
 * variant ids by hand, and both ways that went wrong happened: a product id
 * pasted where a variant belonged (nobody could pay) and one cadence's id in
 * both slots (the yearly button charged the monthly price). A lookup key is
 * written once by the setup script, means the same thing in test and live mode,
 * and moves to a new price with `transfer_lookup_key` when a price changes — so
 * there is nothing to re-paste and no deploy.
 *
 * **One product per plan and cadence**, not one per plan, because a Stripe
 * coupon can be limited to products but not to prices — and the discount console
 * offers "Pro yearly only".
 */

export const PLAN_OFFERS: readonly PlanOffer[] = [
  { plan: "starter", cadence: "monthly" },
  { plan: "starter", cadence: "yearly" },
  { plan: "pro", cadence: "monthly" },
  { plan: "pro", cadence: "yearly" },
];

/** The lookup key a plan is sold under. Hand-kept in step with `scripts/setup-stripe.mjs`. */
export function lookupKeyFor(plan: PaidPlanId, cadence: BillingCadence): string {
  return `pinglide_${plan}_${cadence}`;
}

/** Which plan a lookup key is, or null for a price that is none of ours. */
export function offerForLookupKey(key: string | null | undefined): PlanOffer | null {
  return PLAN_OFFERS.find((offer) => lookupKeyFor(offer.plan, offer.cadence) === key) ?? null;
}

/** A price object (or a bare id, which carries no key) as one of our plans. */
export function offerForPrice(price: Stripe.Price | string | null | undefined): PlanOffer | null {
  return price && typeof price === "object" ? offerForLookupKey(price.lookup_key) : null;
}

type Catalogue = Map<string, { priceId: string; productId: string }>;

/**
 * How long the catalogue is trusted. Short enough that a price moved in the
 * dashboard is picked up within minutes, long enough that a checkout does not
 * cost a second request.
 */
const TTL_MS = 5 * 60_000;

const holder = globalThis as typeof globalThis & {
  __pinglideStripeCatalogue?: { at: number; value: Promise<Catalogue> };
};

/** Every active price behind our four lookup keys, cached; a failure is never cached. */
function catalogue(): Promise<Catalogue> {
  const cached = holder.__pinglideStripeCatalogue;
  if (cached && Date.now() - cached.at < TTL_MS) return cached.value;

  const value = call("list prices", (client) =>
    client.prices.list({
      lookup_keys: PLAN_OFFERS.map((offer) => lookupKeyFor(offer.plan, offer.cadence)),
      active: true,
      limit: 10,
    }),
  ).then((list) => {
    const map: Catalogue = new Map();
    for (const price of list.data) {
      if (price.lookup_key) {
        map.set(price.lookup_key, {
          priceId: price.id,
          productId: typeof price.product === "string" ? price.product : price.product.id,
        });
      }
    }
    return map;
  });

  holder.__pinglideStripeCatalogue = { at: Date.now(), value };
  value.catch(() => {
    if (holder.__pinglideStripeCatalogue?.value === value) holder.__pinglideStripeCatalogue = undefined;
  });

  return value;
}

/** For the tests: forget the cached catalogue. */
export function resetPriceCache(): void {
  holder.__pinglideStripeCatalogue = undefined;
}

/** The price a plan is charged at. Throws, naming the key, when the store has none. */
export async function priceIdFor(plan: PaidPlanId, cadence: BillingCadence): Promise<string> {
  const key = lookupKeyFor(plan, cadence);
  const entry = (await catalogue()).get(key);

  if (!entry) {
    throw new BillingError(
      `No active price has the lookup key ${key}. Run npm run setup:stripe.`,
    );
  }

  return entry.priceId;
}

/** The product a plan is sold as, for limiting a coupon to it. */
export async function productIdFor(offer: PlanOffer): Promise<string> {
  const key = lookupKeyFor(offer.plan, offer.cadence);
  const entry = (await catalogue()).get(key);

  if (!entry) {
    throw new BillingError(
      `No active price has the lookup key ${key}. Run npm run setup:stripe.`,
    );
  }

  return entry.productId;
}

/** Product ids back to our plans, for reading a coupon's `applies_to`. */
export async function offersByProduct(): Promise<Map<string, PlanOffer>> {
  const map = new Map<string, PlanOffer>();

  for (const [key, entry] of await catalogue()) {
    const offer = offerForLookupKey(key);
    if (offer) map.set(entry.productId, offer);
  }

  return map;
}
