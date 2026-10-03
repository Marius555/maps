import "server-only";

import { requireAdmin } from "@/lib/admin/auth/guard";
import { BillingError, getBilling, type Discount, type DiscountStatus } from "@/lib/billing";
import { discountStatus } from "@/lib/billing/discounts";
import { env } from "@/lib/env";
import { getPromotion } from "@/lib/repositories/promotions.repository";

export type DiscountRow = Discount & {
  status: DiscountStatus;
  /** The promotion shown on /pricing for everybody. */
  featured: boolean;
};

export type DiscountsPage = {
  discounts: DiscountRow[];
  /** Why the list could not be read; null when it was. The page says this instead of erroring. */
  error: string | null;
  /** Where share links point. Server config, so it is handed down rather than read in the browser. */
  appUrl: string;
};

/**
 * What the console's Discounts page lists, read live from the provider —
 * there is no copy of these in Appwrite (docs/notes/billing.md, "Discounts").
 * The status is decided here, once, so server and browser agree on it.
 */
export async function loadDiscounts(): Promise<DiscountsPage> {
  await requireAdmin();

  let discounts: Discount[];

  try {
    discounts = await getBilling().listDiscounts();
  } catch (error) {
    if (!(error instanceof BillingError)) throw error;

    return { discounts: [], error: error.message, appUrl: env.appUrl };
  }

  const now = Date.now();
  // An unreadable promotion marks nothing; the list itself is still worth drawing.
  const promotion = await getPromotion().catch(() => null);

  return {
    discounts: discounts.map((discount) => ({
      ...discount,
      status: discountStatus(discount, now),
      featured: discount.id === promotion?.discountId,
    })),
    error: null,
    appUrl: env.appUrl,
  };
}
