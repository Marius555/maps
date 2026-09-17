import "server-only";

import { RepositoryError } from "@/lib/repositories/errors";
import { MAX_SOURCE_BYTES, formatMb } from "./limits";
import type { SheetReference } from "./sheet-url";

const TIMEOUT_MS = 15_000;

/**
 * A shared Google Sheet, as CSV text.
 *
 * Shared by the import's fetch route and by sheet sync, so the two can never
 * disagree about what "that sheet isn't shared" looks like — Google reports it
 * by serving its sign-in page, often with a 200, and a second copy of that check
 * that forgot the content type would parse a login form as a spreadsheet.
 *
 * Not a proxy. The address is composed here from an id already constrained to
 * `[A-Za-z0-9-_]+` by the schema, and the host is a literal, so nothing a caller
 * sends can aim the server anywhere else.
 *
 * Failures throw a `RepositoryError`, whose message is user-facing and whose
 * status the route returns as-is.
 */
export async function fetchGoogleSheetCsv(reference: SheetReference): Promise<string> {
  const url = reference.published
    ? `https://docs.google.com/spreadsheets/d/e/${reference.sheetId}/pub?output=csv${
        reference.gid ? `&gid=${reference.gid}` : ""
      }`
    : `https://docs.google.com/spreadsheets/d/${reference.sheetId}/export?format=csv${
        reference.gid ? `&gid=${reference.gid}` : ""
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

    throw new RepositoryError(
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

  if (
    response.status === 401 ||
    response.status === 403 ||
    contentType.includes("text/html")
  ) {
    throw new RepositoryError(
      "forbidden",
      "That sheet isn't shared. In Google Sheets choose Share → General access → Anyone with the link → Viewer, then paste the link again.",
      403,
    );
  }

  if (response.status === 404) {
    throw new RepositoryError(
      "not_found",
      "We couldn't find that sheet. Check the link, or that the tab still exists.",
      404,
    );
  }

  if (!response.ok) {
    throw new RepositoryError(
      "internal_error",
      "Google Sheets couldn't give us that file. Try again in a moment.",
      502,
    );
  }

  const declared = Number(response.headers.get("content-length") ?? "");
  if (Number.isFinite(declared) && declared > MAX_SOURCE_BYTES) {
    throw new RepositoryError("validation_failed", tooBig(declared), 422);
  }

  const csv = await response.text();

  // Content-Length is absent on a chunked response, so the real check is here.
  if (csv.length > MAX_SOURCE_BYTES) {
    throw new RepositoryError("validation_failed", tooBig(csv.length), 422);
  }

  return csv;
}

function tooBig(bytes: number): string {
  return `That sheet is ${formatMb(bytes)}. Split it into sheets under ${formatMb(MAX_SOURCE_BYTES)} and import them one at a time.`;
}
