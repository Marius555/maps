import { apiFetch } from "@/lib/query/fetcher";
import type { SheetReference } from "../sheet-url";
import { readCsvText } from "./csv";
import type { SourceTable } from "./types";

/**
 * A shared Google Sheet, via our own route.
 *
 * The fetch has to happen server-side — Google's export endpoint sends no CORS
 * headers, so the browser can't read the response — but everything after it is
 * the CSV path unchanged. The sheet arrives as text and is parsed here, in the
 * browser, like any other file.
 */
export async function readGoogleSheet(
  mapId: string,
  reference: SheetReference,
): Promise<SourceTable> {
  const { csv } = await apiFetch<{ csv: string }>(
    `/api/maps/${mapId}/import/google-sheet`,
    {
      method: "POST",
      body: JSON.stringify({
        sheetId: reference.sheetId,
        gid: reference.gid,
        published: reference.published,
      }),
    },
  );

  return readCsvText(csv, "Google Sheet");
}
