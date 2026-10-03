import "server-only";

import { env } from "@/lib/env";
import { assertNumericId, BillingError, send } from "./lemon-api";
import type {
  Discount,
  DiscountAmountType,
  DiscountDuration,
  DiscountInput,
  DiscountRedemption,
  DiscountRedemptionPage,
  PlanOffer,
} from "./types";

/**
 * Discount codes at Lemon Squeezy, for the operator console.
 *
 * **The provider is the only record.** Nothing here writes Appwrite: a code is
 * made, listed and deleted at the provider and read live each time the console
 * asks, the posture the `subscriptions` rows take for the same reason — a second
 * copy is a second answer that can disagree with the one that charges cards.
 *
 * **There is no update.** The provider's API creates, reads and deletes a
 * discount and has no call that changes one. The console offers Duplicate (the
 * create form, pre-filled) instead of Edit.
 *
 * Nothing here is in a visitor's path or a customer's: only `/admin` reads it.
 */

const PLANS = ["starter", "pro"] as const;
const CADENCES = ["monthly", "yearly"] as const;

/** The provider's own page cap. One page is every discount a store this size will have. */
const DISCOUNT_PAGE_SIZE = 100;

/** Who-used-it rows per page. Each may cost one order lookup, so it stays small. */
export const REDEMPTION_PAGE_SIZE = 25;

/**
 * How many redemption counts are asked for at once. The provider allows 300
 * requests a minute per key; a burst of a hundred would spend a third of that on
 * one page load, and checkouts share the key.
 */
const COUNT_CONCURRENCY = 8;

type DiscountAttributes = {
  name?: string;
  code?: string;
  amount?: number;
  amount_type?: string;
  is_limited_to_products?: boolean;
  is_limited_redemptions?: boolean;
  max_redemptions?: number;
  starts_at?: string | null;
  expires_at?: string | null;
  duration?: string;
  duration_in_months?: number;
  test_mode?: boolean;
  created_at?: string;
};

type Linkage = { type?: string; id?: string | number };

type DiscountResource = {
  id?: string | number;
  attributes?: DiscountAttributes;
  relationships?: { variants?: { data?: Linkage[] | null } };
};

type ListResponse<R> = {
  data?: R[];
  included?: { type?: string; id?: string | number; attributes?: Record<string, unknown> }[];
  meta?: { page?: { currentPage?: number; lastPage?: number; total?: number } };
};

/* ------------------------------------------------------------------ *
 * Our plans ↔ the provider's variants
 * ------------------------------------------------------------------ */

function variantOf({ plan, cadence }: PlanOffer): string {
  const variant = env.lemonVariants[plan][cadence];

  if (!variant) {
    throw new BillingError(
      `No ${cadence} variant is configured for the ${plan} plan. Set LEMON_VARIANT_${plan.toUpperCase()}_${cadence.toUpperCase()}.`,
    );
  }

  return variant;
}

/**
 * The variant ids a discount is limited to, as our plans. Ids that are none of
 * ours are reported, not guessed at: a plan list shorter than the truth has to
 * say so.
 */
export function plansForVariants(variantIds: readonly string[]): {
  plans: PlanOffer[];
  otherProducts: boolean;
} {
  const plans: PlanOffer[] = [];
  let otherProducts = false;

  for (const id of variantIds) {
    const offer = PLANS.flatMap((plan) =>
      CADENCES.filter((cadence) => env.lemonVariants[plan][cadence] === id).map((cadence) => ({
        plan,
        cadence,
      })),
    )[0];

    if (offer) plans.push(offer);
    else otherProducts = true;
  }

  return { plans, otherProducts };
}

/* ------------------------------------------------------------------ *
 * Reading
 * ------------------------------------------------------------------ */

function amountTypeOf(value: string | undefined): DiscountAmountType {
  return value === "fixed" ? "fixed" : "percent";
}

function durationOf(value: string | undefined): DiscountDuration {
  return value === "repeating" || value === "forever" ? value : "once";
}

/** A discount resource as ours. Exported for the tests. */
export function toDiscount(resource: DiscountResource, uses: number | null): Discount | null {
  const attributes = resource.attributes;
  if (!attributes || resource.id === undefined) return null;

  const duration = durationOf(attributes.duration);
  const limited = attributes.is_limited_to_products === true;
  const variantIds = (resource.relationships?.variants?.data ?? []).map((link) => String(link.id));
  const { plans, otherProducts } = limited
    ? plansForVariants(variantIds)
    : { plans: [], otherProducts: false };

  return {
    id: String(resource.id),
    name: attributes.name ?? "",
    code: attributes.code ?? "",
    amountType: amountTypeOf(attributes.amount_type),
    amount: attributes.amount ?? 0,
    duration,
    months: duration === "repeating" ? (attributes.duration_in_months ?? 1) : null,
    maxUses: attributes.is_limited_redemptions ? (attributes.max_redemptions ?? null) : null,
    startsAt: attributes.starts_at ?? null,
    expiresAt: attributes.expires_at ?? null,
    plans,
    // Limited, but to nothing we could read back: say so rather than show "every plan".
    otherProducts: otherProducts || (limited && plans.length === 0),
    testMode: attributes.test_mode === true,
    createdAt: attributes.created_at ?? "",
    uses,
  };
}

/** How many times one discount has been redeemed, or null when the provider would not say. */
export async function countRedemptions(discountId: string): Promise<number | null> {
  try {
    const json = await send<ListResponse<unknown>>(
      `/discount-redemptions?${new URLSearchParams({
        "filter[discount_id]": discountId,
        "page[size]": "1",
      }).toString()}`,
      { method: "GET" },
    );

    return json.meta?.page?.total ?? json.data?.length ?? 0;
  } catch {
    // One count the provider would not give is a "—" in its row, not a page
    // that fails to draw every other discount.
    return null;
  }
}

/** `fn` over `items`, at most `limit` at a time, in order. */
async function mapLimited<T, R>(
  items: readonly T[],
  limit: number,
  fn: (item: T) => Promise<R>,
): Promise<R[]> {
  const results: R[] = new Array<R>(items.length);
  let next = 0;

  async function worker() {
    while (next < items.length) {
      const index = next++;
      results[index] = await fn(items[index]);
    }
  }

  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, worker));

  return results;
}

function storeId(): string {
  if (!env.lemonStoreId) {
    throw new BillingError(
      "LEMON_STORE_ID is not set, so discounts are unavailable. Add it to .env and restart.",
    );
  }

  return env.lemonStoreId;
}

/**
 * Every discount in the store, newest first, **without** use counts (`uses` is
 * null) — one request. The pricing page's lookup reads this, and counts only
 * the one code it is asked about (`countRedemptions`).
 */
export async function listDiscountsBare(): Promise<Discount[]> {
  const query = new URLSearchParams({
    "filter[store_id]": storeId(),
    // So `relationships.variants.data` carries the ids a limited code applies to.
    include: "variants",
    "page[size]": String(DISCOUNT_PAGE_SIZE),
  });

  const json = await send<ListResponse<DiscountResource>>(`/discounts?${query.toString()}`, {
    method: "GET",
  });

  return (json.data ?? [])
    .map((resource) => toDiscount(resource, null))
    .filter((discount): discount is Discount => discount !== null)
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

/** Every discount with its use count — the operator console's list. */
export async function listDiscounts(): Promise<Discount[]> {
  const discounts = await listDiscountsBare();
  const counts = await mapLimited(discounts, COUNT_CONCURRENCY, (discount) =>
    countRedemptions(discount.id),
  );

  return discounts.map((discount, index) => ({ ...discount, uses: counts[index] }));
}

/* ------------------------------------------------------------------ *
 * Writing
 * ------------------------------------------------------------------ */

/**
 * The request body for a new discount. Exported for the tests.
 *
 * Every optional attribute is **left out** rather than sent as `null` or
 * `false`: the provider's defaults (no start, no expiry, unlimited, every
 * product, once) are what "not chosen" means, and saying them twice is a
 * second place to be wrong.
 */
export function discountRequestBody(input: DiscountInput) {
  const variants = input.plans.map(variantOf);

  return {
    data: {
      type: "discounts",
      attributes: {
        name: input.name,
        code: input.code,
        amount: input.amount,
        amount_type: input.amountType,
        duration: input.duration,
        ...(input.duration === "repeating" && input.months
          ? { duration_in_months: input.months }
          : {}),
        ...(input.maxUses
          ? { is_limited_redemptions: true, max_redemptions: input.maxUses }
          : {}),
        ...(input.startsAt ? { starts_at: input.startsAt } : {}),
        ...(input.expiresAt ? { expires_at: input.expiresAt } : {}),
        ...(variants.length > 0 ? { is_limited_to_products: true } : {}),
      },
      relationships: {
        store: { data: { type: "stores", id: storeId() } },
        ...(variants.length > 0
          ? { variants: { data: variants.map((id) => ({ type: "variants", id })) } }
          : {}),
      },
    },
  };
}

export async function createDiscount(input: DiscountInput): Promise<Discount> {
  const json = await send<{ data?: DiscountResource }>("/discounts", {
    method: "POST",
    body: discountRequestBody(input),
  });

  const discount = json.data ? toDiscount(json.data, 0) : null;

  if (!discount) {
    throw new BillingError("The payment provider made the discount but returned nothing to show.");
  }

  // The create reply carries no variant linkage; the plans are the ones just sent.
  return { ...discount, plans: input.plans, otherProducts: false };
}

export async function deleteDiscount(discountId: string): Promise<void> {
  await send<void>(`/discounts/${assertNumericId(discountId, "discount id")}`, {
    method: "DELETE",
  });
}

/* ------------------------------------------------------------------ *
 * Who used it
 * ------------------------------------------------------------------ */

type RedemptionResource = {
  id?: string | number;
  attributes?: { order_id?: number | string; amount?: number; created_at?: string };
};

type OrderFacts = { email: string | null; currency: string | null };

function orderFacts(attributes: Record<string, unknown> | undefined): OrderFacts {
  return {
    email: typeof attributes?.user_email === "string" ? attributes.user_email : null,
    currency: typeof attributes?.currency === "string" ? attributes.currency : null,
  };
}

async function fetchOrder(orderId: string): Promise<OrderFacts> {
  try {
    const json = await send<{ data?: { attributes?: Record<string, unknown> } }>(
      `/orders/${assertNumericId(orderId, "order id")}`,
      { method: "GET" },
    );

    return orderFacts(json.data?.attributes);
  } catch {
    return { email: null, currency: null };
  }
}

export async function listDiscountRedemptions(
  discountId: string,
  page: number,
): Promise<DiscountRedemptionPage> {
  const query = new URLSearchParams({
    "filter[discount_id]": assertNumericId(discountId, "discount id"),
    include: "order",
    "page[number]": String(Math.max(1, Math.floor(page))),
    "page[size]": String(REDEMPTION_PAGE_SIZE),
  });

  const json = await send<ListResponse<RedemptionResource>>(
    `/discount-redemptions?${query.toString()}`,
    { method: "GET" },
  );

  const included = new Map<string, OrderFacts>();
  for (const entry of json.included ?? []) {
    if (entry.type === "orders" && entry.id !== undefined) {
      included.set(String(entry.id), orderFacts(entry.attributes));
    }
  }

  const rows = (json.data ?? []).filter((row) => row.id !== undefined && row.attributes);

  // An order the reply did not include is asked for on its own — at most a page of them.
  const orders = await mapLimited(rows, COUNT_CONCURRENCY, async (row) => {
    const orderId = String(row.attributes?.order_id ?? "");
    if (!orderId) return { email: null, currency: null };

    return included.get(orderId) ?? fetchOrder(orderId);
  });

  const redemptions: DiscountRedemption[] = rows.map((row, index) => ({
    id: String(row.id),
    createdAt: row.attributes?.created_at ?? "",
    saved: row.attributes?.amount ?? 0,
    ...orders[index],
  }));

  const lastPage = Math.max(1, json.meta?.page?.lastPage ?? 1);

  return {
    redemptions,
    page: Math.min(lastPage, Math.max(1, json.meta?.page?.currentPage ?? 1)),
    lastPage,
  };
}
