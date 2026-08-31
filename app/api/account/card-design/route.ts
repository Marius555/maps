import { fail, ok } from "@/lib/api/responses";
import { parseBody, withAuth } from "@/lib/api/route";
import { CARD_DESIGNER_ENABLED } from "@/lib/card/designer-status";
import {
  getCardDesign,
  saveCardDesign,
} from "@/lib/repositories/card-design.repository";
import { updateCardDesignSchema } from "@/lib/validation/card-design.schema";

/**
 * `GET` keeps working whatever the flag says: a design saved before the tool
 * was switched off is still the owner's, and reading it is what makes turning
 * the tool back on give them their card rather than a blank one.
 */
export const GET = withAuth(async ({ ctx }) =>
  ok({ cardLayout: await getCardDesign(ctx) }),
);

/**
 * Refused while the designer is unfinished, and refused *here* rather than only
 * in the component that draws it.
 *
 * A layout written now would be produced by a half-built tool and read by every
 * published snapshot, so the rule has to hold for anything that can reach the
 * route — a stale tab left open from before the flag moved, or a request made by
 * hand. See lib/card/designer-status.ts.
 */
export const PATCH = withAuth(async ({ request, ctx }) => {
  if (!CARD_DESIGNER_ENABLED) {
    return fail(
      "forbidden",
      "The card designer isn't finished yet, so every map uses the default card. Nothing was saved.",
      403,
    );
  }

  const input = await parseBody(request, updateCardDesignSchema);
  return ok({ cardLayout: await saveCardDesign(ctx, input.cardLayout) });
});
