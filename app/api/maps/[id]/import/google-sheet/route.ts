import { fail, ok } from "@/lib/api/responses";
import { parseBody, withAuth } from "@/lib/api/route";
import { MAX_SOURCE_BYTES, formatMb } from "@/lib/import/limits";
import { getMap } from "@/lib/repositories/maps.repository";
import { googleSheetSourceSchema } from "@/lib/validation/import-source.schema";

type Params = { id: string };

const TIMEOUT_MS = 15_000;

/**
 * Fetches a shared Google Sheet as CSV.
 *
 * This has to be a server route: Google's export endpoint sends no CORS headers,
 * so the browser cannot read the response itself. It is not a §2 violation —
 * this runs while the customer is building their map, never when a visitor loads
 * it, and nothing about it reaches the published snapshot.
 *
 * It is not a proxy. The URL is composed here from an id the schema has already
 * constrained to `[A-Za-z0-9-_]+`, and the host is a literal. Accepting a URL
 * from the client instead would let any logged-in user aim our server at
 * anything reachable from it.
 */
export const POST = withAuth<Params>(async ({ request, params, ctx }) => {
  // Ownership, so the endpoint isn't a general-purpose fetcher for anyone with
  // an account.
  await getMap(ctx, params.id);

  const input = await parseBody(request, googleSheetSourceSchema);

  const url = input.published
    ? `https://docs.google.com/spreadsheets/d/e/${input.sheetId}/pub?output=csv${
        input.gid ? `&gid=${input.gid}` : ""
      }`
    : `https://docs.google.com/spreadsheets/d/${input.sheetId}/export?format=csv${
        input.gid ? `&gid=${input.gid}` : ""
      }`;

  let response: Response;

  try {
    response = await fetch(url, {
      redirect: "follow",
      signal: AbortSignal.timeout(TIMEOUT_MS),
      headers: { accept: "text/csv,text/plain" },
      cache: "no-store",
    });
  } catch (error) {
    const timedOut = error instanceof Error && error.name === "TimeoutError";

    return fail(
      timedOut ? "rate_limited" : "internal_error",
      timedOut
        ? "Google took too long to answer. Try again in a moment."
        : "We couldn't reach Google Sheets. Try again in a moment.",
      timedOut ? 504 : 502,
    );
  }

  // An unshared sheet is the single most common failure, and Google reports it
  // by serving the sign-in page — frequently with status 200, so the status code
  // alone would have us parse an HTML login form as a spreadsheet.
  const contentType = response.headers.get("content-type") ?? "";

  if (response.status === 401 || response.status === 403 || contentType.includes("text/html")) {
    return fail(
      "forbidden",
      "That sheet isn't shared. In Google Sheets choose Share → General access → Anyone with the link → Viewer, then paste the link again.",
      403,
    );
  }

  if (response.status === 404) {
    return fail(
      "not_found",
      "We couldn't find that sheet. Check the link, or that the tab still exists.",
      404,
    );
  }

  if (!response.ok) {
    return fail(
      "internal_error",
      "Google Sheets couldn't give us that file. Try again in a moment.",
      502,
    );
  }

  const declared = Number(response.headers.get("content-length") ?? "");
  if (Number.isFinite(declared) && declared > MAX_SOURCE_BYTES) {
    return fail("validation_failed", tooBig(declared), 422);
  }

  const csv = await response.text();

  // Content-Length is absent on a chunked response, so the real check is here.
  if (csv.length > MAX_SOURCE_BYTES) {
    return fail("validation_failed", tooBig(csv.length), 422);
  }

  return ok({ csv });
});

function tooBig(bytes: number): string {
  return `That sheet is ${formatMb(bytes)}. Split it into sheets under ${formatMb(MAX_SOURCE_BYTES)} and import them one at a time.`;
}
