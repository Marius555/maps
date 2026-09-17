import { ok } from "@/lib/api/responses";
import { parseBody, withAuth } from "@/lib/api/route";
import { fetchGoogleSheetCsv } from "@/lib/import/google-sheet-fetch";
import { getMap } from "@/lib/repositories/maps.repository";
import { googleSheetSourceSchema } from "@/lib/validation/import-source.schema";

type Params = { id: string };

/**
 * Fetches a shared Google Sheet as CSV.
 *
 * This has to be a server route: Google's export endpoint sends no CORS headers,
 * so the browser cannot read the response itself. It is not a §2 violation —
 * this runs while the customer is building their map, never when a visitor loads
 * it, and nothing about it reaches the published snapshot.
 *
 * The fetch and every one of its refusals live in `fetchGoogleSheetCsv`, which
 * sheet sync reads the same sheet through. The route adds ownership, so it isn't
 * a general-purpose fetcher for anyone with an account.
 */
export const POST = withAuth<Params>(async ({ request, params, ctx }) => {
  await getMap(ctx, params.id);

  const input = await parseBody(request, googleSheetSourceSchema);

  return ok({ csv: await fetchGoogleSheetCsv(input) });
});
