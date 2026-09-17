import { fail, ok } from "@/lib/api/responses";
import { parseBody, withAuth } from "@/lib/api/route";
import { NotFoundError } from "@/lib/repositories/errors";
import { getSheetLink } from "@/lib/repositories/sheet-links.repository";
import { runSheetSyncStep } from "@/lib/sheet-sync/run";
import { toSheetLinkView } from "@/lib/sheet-sync/types";
import { syncSheetSchema } from "@/lib/validation/sheet-link.schema";

type Params = { id: string };

/**
 * One step of Sync now.
 *
 * A step, not the whole sync, because the host answers no request past its
 * site timeout (Appwrite Sites: 15s by default, 30s at most). `more: true`
 * means the browser should call again with `continuing: true` — see
 * `useSyncSheet` — and each step's counts are added to the last.
 *
 * Answers with the report whatever happened, including a refusal the owner has
 * to act on (`needs_confirmation`, `failed`): those are outcomes of a sync that
 * ran, not failed requests, and the panel draws each one. Only a sync that could
 * not start at all is an error status.
 */
export const POST = withAuth<Params>(async ({ request, params, ctx }) => {
  const input = await parseBody(request, syncSheetSchema);
  const link = await getSheetLink(ctx, params.id);

  if (!link) throw new NotFoundError("This map isn't linked to a Google Sheet.");

  const outcome = await runSheetSyncStep(link, {
    confirmRemovals: input.confirmRemovals,
    continuing: input.continuing,
  });

  if (outcome.status === "busy") {
    return fail(
      "conflict",
      "This map is already syncing. Wait a moment, then look again.",
      409,
    );
  }

  return ok({
    status: outcome.status,
    report: outcome.report,
    more: outcome.more,
    link: toSheetLinkView(outcome.link),
  });
});
