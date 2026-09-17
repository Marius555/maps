import { noContent, ok } from "@/lib/api/responses";
import { parseBody, withAuth } from "@/lib/api/route";
import { NotFoundError } from "@/lib/repositories/errors";
import {
  deleteSheetLink,
  getSheetLink,
  saveSheetLink,
  setSheetAutoSync,
} from "@/lib/repositories/sheet-links.repository";
import { toSheetLinkView } from "@/lib/sheet-sync/types";
import {
  saveSheetLinkSchema,
  updateSheetLinkSchema,
} from "@/lib/validation/sheet-link.schema";

type Params = { id: string };

/**
 * A map's link to a Google Sheet. docs/notes/sheet-sync.md.
 *
 * `GET` answers `{ link: null }` rather than 404 for a map with no link, because
 * "not linked" is the ordinary state of nearly every map and the Locations page
 * asks on every load — a 404 there would be an error nobody made.
 */
export const GET = withAuth<Params>(async ({ params, ctx }) => {
  const link = await getSheetLink(ctx, params.id);

  return ok({ link: link ? toSheetLinkView(link) : null });
});

/** Link, or re-link, after an import that asked to keep the map in sync. */
export const POST = withAuth<Params>(async ({ request, params, ctx }) => {
  const input = await parseBody(request, saveSheetLinkSchema);
  const link = await saveSheetLink(ctx, params.id, input);

  return ok({ link: toSheetLinkView(link) });
});

/** The daily switch. */
export const PATCH = withAuth<Params>(async ({ request, params, ctx }) => {
  const input = await parseBody(request, updateSheetLinkSchema);
  const link = await setSheetAutoSync(ctx, params.id, input.autoSync);

  if (!link) throw new NotFoundError("This map isn't linked to a Google Sheet.");

  return ok({ link: toSheetLinkView(link) });
});

/** Unlink. The locations stay. */
export const DELETE = withAuth<Params>(async ({ params, ctx }) => {
  await deleteSheetLink(ctx, params.id);

  return noContent();
});
