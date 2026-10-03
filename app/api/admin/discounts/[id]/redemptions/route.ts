import { z } from "zod";

import { fail, ok } from "@/lib/api/responses";
import { withAdmin } from "@/lib/api/route";
import { BillingError, getBilling } from "@/lib/billing";

const pageSchema = z.coerce.number().int().min(1).max(1000).catch(1);

/** One page of who redeemed a discount, read live from the provider. */
export const GET = withAdmin<{ id: string }>(async (request, { id }) => {
  const page = pageSchema.parse(request.nextUrl.searchParams.get("page") ?? 1);

  try {
    return ok(await getBilling().listDiscountRedemptions(id, page));
  } catch (error) {
    if (!(error instanceof BillingError)) throw error;

    return fail("internal_error", error.message, error.status === 404 ? 404 : 502);
  }
});
