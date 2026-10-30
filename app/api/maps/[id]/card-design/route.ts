import { ok } from "@/lib/api/responses";
import { parseBody, withMapAuth } from "@/lib/api/route";
import {
  getCardDesign,
  saveCardDesign,
} from "@/lib/repositories/card-design.repository";
import { updateCardDesignSchema } from "@/lib/validation/card-design.schema";

type Params = { id: string };

/**
 * The card design of the workspace this map is in, raw. `{}` for one that has
 * never saved.
 *
 * **Under the map, though the design is the workspace's**, because every page
 * that draws or edits a card is a map's page. Read through the active-team
 * cookie instead, a designer open on a team's map would read — and save — the
 * card of whichever team another tab had switched to. The map names the
 * workspace unambiguously; `withMapAuth` resolves it.
 */
export const GET = withMapAuth<Params>(async ({ ctx }) =>
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
export const PATCH = withMapAuth<Params>(async ({ request, ctx }) => {
  const input = await parseBody(request, updateCardDesignSchema);
  return ok({ cardLayout: await saveCardDesign(ctx, input.cardLayout) });
});
