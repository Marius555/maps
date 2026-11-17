/**
 * The payment provider's half of the wipe. Deleting a `subscriptions` row does
 * not stop a card being charged, so a live subscription is cancelled at the
 * provider first — at once, not at the period's end, because the account is
 * about to stop existing. Discount codes live only at the provider
 * (docs/notes/billing.md, "Discounts"), so retiring them happens there too: the
 * promotion code is switched off and its coupon deleted, as
 * lib/billing/stripe-discounts.ts does.
 */

import Stripe from "stripe";

/** The key decides test or live mode, as everywhere else (CLAUDE.md, Environment). */
export function stripeKey() {
  return process.env.STRIPE_SECRET_KEY ?? "";
}

let client = null;

function stripe() {
  client ??= new Stripe(stripeKey(), { timeout: 15_000, maxNetworkRetries: 1 });
  return client;
}

/**
 * The provider's status, or null when it has no such subscription — including
 * a row left over from Lemon Squeezy, whose numeric ids Stripe never issued.
 */
export async function subscriptionStatus(subscriptionId) {
  if (!/^sub_[A-Za-z0-9]+$/.test(subscriptionId ?? "")) return null;

  try {
    const subscription = await stripe().subscriptions.retrieve(subscriptionId);
    return subscription.status;
  } catch (error) {
    // The message is never printed in full: it can carry customer details.
    if (error?.statusCode === 404) return null;
    throw new Error(`Reading ${subscriptionId} answered HTTP ${String(error?.statusCode ?? "?")}`);
  }
}

export async function cancelSubscription(subscriptionId) {
  await stripe().subscriptions.cancel(subscriptionId);
}

/** Every live promotion code, with the coupon behind it. */
export async function listDiscounts() {
  const discounts = [];

  for await (const code of stripe().promotionCodes.list({ active: true, limit: 100 })) {
    const coupon = code.promotion?.coupon;
    discounts.push({
      id: code.id,
      code: code.code,
      couponId: typeof coupon === "string" ? coupon : (coupon?.id ?? null),
    });
  }

  return discounts;
}

export async function deleteDiscount(discount) {
  await stripe().promotionCodes.update(discount.id, { active: false });

  if (discount.couponId) {
    await stripe().coupons.del(discount.couponId).catch(() => undefined);
  }
}
