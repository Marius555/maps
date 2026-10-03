import "server-only";

import { getPromotion, type Promotion } from "@/lib/repositories/promotions.repository";
import { discountStatus } from "./discounts";
import { countRedemptions, listDiscountsBare } from "./lemon-discounts";
import type { Discount, PricingOffer, PublicDiscount } from "./types";

/**
 * What the pricing page may show: the featured promotion, and the code a
 * visitor asked about — `GET /api/pricing/offer`. docs/notes/billing.md,
 * "Discounts".
 *
 * **Cached in memory for a minute, every part of it.** The pricing page is
 * public and can be busy; without this every visit would be a request to the
 * payment provider and one to Appwrite. With it, a busy page costs one
 * discount list, one promotion read and one count per capped code, per
 * minute, per server process. A minute is also how long an operator's change
 * (a new promo, a deleted code) can take to show — and the provider checks
 * the code again at the checkout regardless, so a stale "valid" costs nothing.
 *
 * A failure is never cached, so a provider wobble heals on the next request.
 */

const TTL_MS = 60_000;

type Entry<T> = { at: number; value: Promise<T> };

let discountsEntry: Entry<Discount[]> | null = null;
let promotionEntry: Entry<Promotion | null> | null = null;
const countEntries = new Map<string, Entry<number | null>>();

function cached<T>(
  entry: Entry<T> | null | undefined,
  load: () => Promise<T>,
  store: (entry: Entry<T> | null) => void,
  now: number,
): Promise<T> {
  if (entry && now - entry.at < TTL_MS) return entry.value;

  const value = load();
  store({ at: now, value });
  // A failure is forgotten at once, so the next request asks again.
  value.catch(() => store(null));

  return value;
}

/** For the tests: forget everything cached. */
export function resetPricingOfferCache(): void {
  discountsEntry = null;
  promotionEntry = null;
  countEntries.clear();
}

function discounts(now: number) {
  return cached(discountsEntry, listDiscountsBare, (entry) => (discountsEntry = entry), now);
}

function promotion(now: number) {
  return cached(promotionEntry, getPromotion, (entry) => (promotionEntry = entry), now);
}

function uses(discount: Discount, now: number): Promise<number | null> {
  // Only a capped code can be used up, so only a capped code is counted.
  if (discount.maxUses === null) return Promise.resolve(null);

  return cached(
    countEntries.get(discount.id),
    () => countRedemptions(discount.id),
    (entry) => (entry ? countEntries.set(discount.id, entry) : countEntries.delete(discount.id)),
    now,
  );
}

function toPublic(discount: Discount): PublicDiscount {
  return {
    code: discount.code,
    amountType: discount.amountType,
    amount: discount.amount,
    duration: discount.duration,
    months: discount.months,
    plans: discount.plans,
    expiresAt: discount.expiresAt,
  };
}

const NOT_LIVE: Record<"expired" | "scheduled" | "used_up", string> = {
  expired: "That code has expired.",
  scheduled: "That code isn't active yet.",
  used_up: "That code has been used up.",
};

/** Why a discount cannot be applied now, or null when it can. */
async function whyNotLive(discount: Discount, now: number): Promise<string | null> {
  const status = discountStatus({ ...discount, uses: await uses(discount, now) }, now);

  return status === "active" ? null : NOT_LIVE[status];
}

export async function pricingOffer(code: string | null, now = Date.now()): Promise<PricingOffer> {
  const all = await discounts(now).catch(() => null);

  let featured: PublicDiscount | null = null;
  const promo = all ? await promotion(now).catch(() => null) : null;
  const promoted = promo ? all?.find((discount) => discount.id === promo.discountId) : undefined;

  if (promoted && (await whyNotLive(promoted, now)) === null) featured = toPublic(promoted);

  if (!code) return { featured, code: null, codeError: null };

  if (!all) {
    return {
      featured,
      code: null,
      codeError: "Couldn't check that code right now. You can still enter it at the checkout.",
      codeUnchecked: true,
    };
  }

  const wanted = code.trim().toUpperCase();
  const match = all.find((discount) => discount.code.toUpperCase() === wanted);

  if (!match) return { featured, code: null, codeError: "That code isn't valid." };

  const why = await whyNotLive(match, now);

  return why
    ? { featured, code: null, codeError: why }
    : { featured, code: toPublic(match), codeError: null };
}
