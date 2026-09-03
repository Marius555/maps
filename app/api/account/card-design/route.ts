import { ok } from "@/lib/api/responses";
import { parseBody, withAuth } from "@/lib/api/route";
import {
  getCardDesign,
  saveCardDesign,
} from "@/lib/repositories/card-design.repository";
import { updateCardDesignSchema } from "@/lib/validation/card-design.schema";

/** The account's own card design, raw. `{}` for one that has never saved. */
export const GET = withAuth(async ({ ctx }) =>
  ok({ cardLayout: await getCardDesign(ctx) }),
);

/**
 * The whole card, written at once.
 *
 * The designer holds a draft locally and sends it on one press of Save, so this
 * takes a complete layout rather than a patch — a card is a shape, not a bag of
 * independent numbers, and a partial write would leave a half-moved block on a
 * customer’s live map. `updateCardDesignSchema` runs `resolveCardLayout` on the
 * way through, so what reaches the repository is already clamped.
 */
export const PATCH = withAuth(async ({ request, ctx }) => {
  const input = await parseBody(request, updateCardDesignSchema);
  return ok({ cardLayout: await saveCardDesign(ctx, input.cardLayout) });
});
