import { z } from "zod";

import { fail, ok } from "@/lib/api/responses";
import { withAuth } from "@/lib/api/route";
import { BillingError, getBilling } from "@/lib/billing";
import { getSubscription } from "@/lib/repositories/subscriptions.repository";

const pageSchema = z.coerce.number().int().min(1).max(1000).catch(1);

/**
 * One page of this account's invoices, for the Billing page's pager.
 *
 * The first page is rendered with the page itself; this answers the rest. By the
 * subscription id on the caller's own row and nothing else, so there is no
 * parameter here that could name somebody else's.
 *
 * A GET, so it is open to an unconfirmed account like every read (`withAuth`'s
 * gate only refuses writes).
 */
export const GET = withAuth(async ({ request, user }) => {
  const page = pageSchema.parse(request.nextUrl.searchParams.get("page") ?? 1);
  const subscription = await getSubscription(user.id);

  if (!subscription?.billingSubscriptionId) {
    return ok({ invoices: [], page: 1, lastPage: 1 });
  }

  try {
    return ok(await getBilling().listInvoices(subscription.billingSubscriptionId, page));
  } catch (error) {
    if (!(error instanceof BillingError)) throw error;

    return fail("internal_error", "Couldn't load your invoices. Try again in a moment.", 502);
  }
});
