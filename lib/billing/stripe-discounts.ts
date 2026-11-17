import "server-only";

import { assertStripeId, BillingError, call, isoFromUnix, unixFromIso, type Stripe } from "./stripe-client";
import { offersByProduct, productIdFor } from "./stripe-prices";
import type {
  Discount,
  DiscountDuration,
  DiscountInput,
  DiscountRedemption,
  DiscountRedemptionPage,
  PlanOffer,
} from "./types";

/**
 * Discount codes at Stripe, for the operator console and the pricing page.
 *
 * **One discount is one promotion code with a coupon of its own.** Stripe splits
 * what a code is worth (the coupon: amount, duration, which products) from the
 * code a buyer types (the promotion code: the string, a cap, an expiry). The
 * console made one thing, so each code gets its own coupon and the two are
 * created and retired together.
 *
 * **The provider is the only record.** Nothing here writes Appwrite: a code is
 * made, listed and retired at Stripe and read live each time, the posture the
 * `subscriptions` rows take for the same reason — a second copy is a second
 * answer that can disagree with the one that charges cards.
 *
 * **There is no update, and there is no delete.** A coupon's terms cannot be
 * changed, and a promotion code can only be switched off — so "Delete" switches
 * the code off and deletes its coupon, and a switched-off code is not listed.
 * The console offers Duplicate instead of Edit.
 *
 * **There is no scheduled start**, so `startsAt` is always null; the console's
 * form no longer offers one.
 */

/** One page is every discount a store this size will have. */
const LIST_LIMIT = 100;

/** Who-used-it rows per page. */
export const REDEMPTION_PAGE_SIZE = 25;

/**
 * How many completed checkouts "Who used it" looks through. Stripe keeps no list
 * of a code's redemptions, so they are found among the checkouts that applied
 * it — the most recent this many.
 */
const REDEMPTION_SCAN_LIMIT = 500;

/** The coupon behind a promotion code, when the reply expanded it. */
function couponOf(code: Stripe.PromotionCode): Stripe.Coupon | null {
  const coupon = code.promotion?.coupon;
  return coupon && typeof coupon === "object" ? coupon : null;
}

/** A coupon's products as our plans. Ids that are none of ours are reported, not guessed. */
function plansFor(
  productIds: readonly string[],
  byProduct: ReadonlyMap<string, PlanOffer>,
): { plans: PlanOffer[]; otherProducts: boolean } {
  const plans: PlanOffer[] = [];
  let otherProducts = false;

  for (const id of productIds) {
    const offer = byProduct.get(id);
    if (offer) plans.push(offer);
    else otherProducts = true;
  }

  return { plans, otherProducts };
}

/** A promotion code (with its coupon expanded) as ours. Exported for the tests. */
export function toDiscount(
  code: Stripe.PromotionCode,
  byProduct: ReadonlyMap<string, PlanOffer>,
): Discount | null {
  const coupon = couponOf(code);
  if (!coupon) return null;

  const percent = coupon.percent_off !== null && coupon.percent_off !== undefined;
  const duration: DiscountDuration =
    coupon.duration === "repeating" ? "repeating" : coupon.duration === "forever" ? "forever" : "once";
  const products = coupon.applies_to?.products ?? [];
  const { plans, otherProducts } = plansFor(products, byProduct);

  return {
    id: code.id,
    name: coupon.name ?? "",
    code: code.code,
    amountType: percent ? "percent" : "fixed",
    amount: percent ? (coupon.percent_off ?? 0) : (coupon.amount_off ?? 0),
    duration,
    months: duration === "repeating" ? (coupon.duration_in_months ?? 1) : null,
    maxUses: code.max_redemptions ?? coupon.max_redemptions ?? null,
    startsAt: null,
    expiresAt: isoFromUnix(code.expires_at ?? coupon.redeem_by),
    plans,
    // Limited, but to nothing we could read back: say so rather than show "every plan".
    otherProducts: otherProducts || (products.length > 0 && plans.length === 0),
    testMode: !code.livemode,
    createdAt: isoFromUnix(code.created) ?? "",
    uses: code.times_redeemed,
  };
}

/**
 * Every live code, newest first, each with its use count — one request, since
 * Stripe counts redemptions on the code itself. The pricing page's lookup and
 * the console's list both read this.
 */
export async function listDiscountsBare(): Promise<Discount[]> {
  const [list, byProduct] = await Promise.all([
    call("list discounts", (client) =>
      client.promotionCodes.list({
        active: true,
        limit: LIST_LIMIT,
        expand: ["data.promotion.coupon.applies_to"],
      }),
    ),
    offersByProduct(),
  ]);

  return list.data
    .map((code) => toDiscount(code, byProduct))
    .filter((discount): discount is Discount => discount !== null)
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

/** The console's list. The same as the bare one: counts come with it. */
export async function listDiscounts(): Promise<Discount[]> {
  return listDiscountsBare();
}

/** How many times one code has been redeemed, or null when the provider would not say. */
export async function countRedemptions(discountId: string): Promise<number | null> {
  try {
    const code = await call("count redemptions", (client) =>
      client.promotionCodes.retrieve(assertStripeId(discountId, "promo", "discount id")),
    );

    return code.times_redeemed;
  } catch {
    return null;
  }
}

/** The live promotion code a buyer's code names, for applying it at the checkout. */
export async function activePromotionCodeId(code: string): Promise<string | null> {
  const list = await call("find discount", (client) =>
    client.promotionCodes.list({ code, active: true, limit: 1 }),
  );

  return list.data[0]?.id ?? null;
}

/**
 * The coupon for a new discount. Exported for the tests.
 *
 * Every optional parameter is **left out** rather than sent as its default:
 * the provider's defaults (unlimited, every product) are what "not chosen"
 * means, and saying them twice is a second place to be wrong.
 */
export function couponParams(input: DiscountInput, productIds: readonly string[]): Stripe.CouponCreateParams {
  return {
    name: input.name.slice(0, 40),
    ...(input.amountType === "percent"
      ? { percent_off: input.amount }
      : { amount_off: input.amount, currency: "eur" }),
    duration: input.duration,
    ...(input.duration === "repeating" && input.months ? { duration_in_months: input.months } : {}),
    ...(productIds.length > 0 ? { applies_to: { products: [...productIds] } } : {}),
  };
}

/** The promotion code for a new discount. Exported for the tests. */
export function promotionCodeParams(input: DiscountInput, couponId: string): Stripe.PromotionCodeCreateParams {
  return {
    promotion: { type: "coupon", coupon: couponId },
    code: input.code,
    ...(input.maxUses ? { max_redemptions: input.maxUses } : {}),
    ...(input.expiresAt ? { expires_at: unixFromIso(input.expiresAt) } : {}),
    expand: ["promotion.coupon.applies_to"],
  };
}

export async function createDiscount(input: DiscountInput): Promise<Discount> {
  const productIds = await Promise.all(input.plans.map(productIdFor));

  const coupon = await call("create coupon", (client) =>
    client.coupons.create(couponParams(input, productIds)),
  );

  let code: Stripe.PromotionCode;

  try {
    code = await call("create promotion code", (client) =>
      client.promotionCodes.create(promotionCodeParams(input, coupon.id)),
    );
  } catch (error) {
    // A code refused (most often: it already exists) must not leave its coupon behind.
    await call("delete coupon", (client) => client.coupons.del(coupon.id)).catch(() => undefined);

    throw error;
  }

  const discount = toDiscount(code, await offersByProduct());

  if (!discount) {
    throw new BillingError("The payment provider made the discount but returned nothing to show.");
  }

  return { ...discount, plans: input.plans, otherProducts: false };
}

/**
 * Stop a code working at the checkout. Subscriptions that already redeemed it
 * keep what they were given: deleting a coupon only stops new redemptions.
 */
export async function deleteDiscount(discountId: string): Promise<void> {
  const id = assertStripeId(discountId, "promo", "discount id");

  const code = await call("retire discount", (client) =>
    client.promotionCodes.update(id, { active: false }),
  );

  const couponId = code.promotion?.coupon;
  if (couponId) {
    const idOfCoupon = typeof couponId === "string" ? couponId : couponId.id;
    await call("delete coupon", (client) => client.coupons.del(idOfCoupon)).catch(() => undefined);
  }
}

/** A completed checkout as one redemption of `discountId`, or null. Exported for the tests. */
export function toRedemption(
  session: Stripe.Checkout.Session,
  discountId: string,
): DiscountRedemption | null {
  const used = (session.discounts ?? []).some((entry) => {
    const code = entry.promotion_code;
    return (typeof code === "string" ? code : code?.id) === discountId;
  });

  if (!used) return null;

  return {
    id: session.id,
    createdAt: isoFromUnix(session.created) ?? "",
    email: session.customer_details?.email ?? null,
    saved: session.total_details?.amount_discount ?? 0,
    currency: session.currency ? session.currency.toUpperCase() : null,
  };
}

export async function listDiscountRedemptions(
  discountId: string,
  page: number,
): Promise<DiscountRedemptionPage> {
  const id = assertStripeId(discountId, "promo", "discount id");
  const found: DiscountRedemption[] = [];

  let after: string | undefined;
  let scanned = 0;

  while (scanned < REDEMPTION_SCAN_LIMIT) {
    const list = await call("list checkouts", (client) =>
      client.checkout.sessions.list({
        status: "complete",
        limit: 100,
        ...(after ? { starting_after: after } : {}),
      }),
    );

    for (const session of list.data) {
      const redemption = toRedemption(session, id);
      if (redemption) found.push(redemption);
    }

    scanned += list.data.length;
    const last = list.data.at(-1);
    if (!list.has_more || !last) break;
    after = last.id;
  }

  const lastPage = Math.max(1, Math.ceil(found.length / REDEMPTION_PAGE_SIZE));
  const current = Math.min(lastPage, Math.max(1, Math.floor(page)));

  return {
    redemptions: found.slice((current - 1) * REDEMPTION_PAGE_SIZE, current * REDEMPTION_PAGE_SIZE),
    page: current,
    lastPage,
  };
}
