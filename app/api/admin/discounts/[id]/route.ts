import { fail, noContent } from "@/lib/api/responses";
import { withAdmin } from "@/lib/api/route";
import { BillingError, getBilling } from "@/lib/billing";
import { clearPromotion } from "@/lib/repositories/promotions.repository";

/**
 * Delete a discount at the provider: the code stops working at the checkout.
 * Subscriptions that already redeemed it keep what they were given. If it was
 * the pricing page's promotion, that goes with it.
 */
export const DELETE = withAdmin<{ id: string }>(async (_request, { id }) => {
  try {
    await getBilling().deleteDiscount(id);
  } catch (error) {
    if (!(error instanceof BillingError)) throw error;

    // Already gone is what was asked for.
    if (error.status !== 404) return fail("internal_error", error.message, 502);
  }

  await clearPromotion(id);

  return noContent();
});
