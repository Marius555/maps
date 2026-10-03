import { ok } from "@/lib/api/responses";
import { withoutAuth } from "@/lib/api/route";
import { pricingOffer } from "@/lib/billing/public-offer";
import { DISCOUNT_CODE_PATTERN } from "@/lib/validation/discount.schema";

/**
 * What the pricing page shows about discounts: the featured promotion, and the
 * code a visitor typed or arrived with. docs/notes/billing.md, "Discounts".
 *
 * Public and session-free, so /pricing stays statically rendered and asks for
 * this after it arrives. Rate-limited per address, because every answer says
 * whether a code exists; cached behind that (`pricingOffer`), so a busy page is
 * not a request to the payment provider per visitor.
 */
export const GET = withoutAuth(
  async (request) => {
    const raw = request.nextUrl.searchParams.get("code")?.trim().toUpperCase() ?? "";

    // A code that cannot exist is answered without asking anybody.
    if (raw && !DISCOUNT_CODE_PATTERN.test(raw)) {
      const offer = await pricingOffer(null);

      return ok({ ...offer, codeError: "That code isn't valid." });
    }

    return ok(await pricingOffer(raw || null));
  },
  { rateLimit: "pricingOffer" },
);
