import { z } from "zod";

import { fail, noContent, ok } from "@/lib/api/responses";
import { parseBody, withAdmin } from "@/lib/api/route";
import { clearPromotion, setPromotion } from "@/lib/repositories/promotions.repository";
import { DISCOUNT_CODE_PATTERN } from "@/lib/validation/discount.schema";

const bodySchema = z.object({ code: z.string().trim().toUpperCase().regex(DISCOUNT_CODE_PATTERN) });

/**
 * Show this discount on /pricing for everybody, in place of any other. The
 * code travels with it only so the row is readable on its own; the pricing
 * lookup finds the discount by id and asks the provider whether it is live.
 */
export const PUT = withAdmin<{ id: string }>(async (request, { id }) => {
  const { code } = await parseBody(request, bodySchema);

  if (!/^\d{1,20}$/.test(id)) {
    return fail("not_found", "That discount isn't one the payment provider issued.", 404);
  }

  return ok(await setPromotion(id, code));
});

/** Stop showing this discount on /pricing. */
export const DELETE = withAdmin<{ id: string }>(async (_request, { id }) => {
  await clearPromotion(id);

  return noContent();
});
