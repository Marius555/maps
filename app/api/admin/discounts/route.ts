import { created, fail } from "@/lib/api/responses";
import { parseBody, withAdmin } from "@/lib/api/route";
import { BillingError, getBilling } from "@/lib/billing";
import { adminDiscountFormSchema, toDiscountInput } from "@/lib/validation/discount.schema";

/**
 * Make a discount code at the provider. docs/notes/billing.md, "Discounts".
 *
 * Nothing is written here: the provider is the only record, and the console's
 * list re-reads it after a create.
 */

/** The provider's attribute names, as the form's field names. */
const FIELD_FOR: Record<string, string> = {
  name: "name",
  code: "code",
  amount: "amount",
  duration_in_months: "months",
  max_redemptions: "maxUses",
  starts_at: "startsAt",
  expires_at: "expiresAt",
};

export const POST = withAdmin(async (request) => {
  const form = await parseBody(request, adminDiscountFormSchema);

  try {
    return created(await getBilling().createDiscount(toDiscountInput(form)));
  } catch (error) {
    if (!(error instanceof BillingError)) throw error;

    /*
     * A refusal about a field goes under that field — the commonest is a code
     * that already exists. The provider's own sentence is shown: this is the
     * operator's console, not a customer's page.
     */
    const fields: Record<string, string[]> = {};
    for (const { attribute, detail } of error.fields) {
      const field = FIELD_FOR[attribute];
      if (field) (fields[field] ??= []).push(detail || "The payment provider refused this value.");
    }

    if (error.status === 422 && Object.keys(fields).length > 0) {
      return fail("validation_failed", "Check the highlighted fields and try again.", 422, fields);
    }

    return fail("internal_error", error.message, 502);
  }
});
