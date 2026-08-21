/**
 * Google Sheets share link → the two things the server needs.
 *
 * Pure, and parsed in the browser rather than the route, for a reason that is
 * easy to miss: the sheet tab lives in the URL *fragment* (`#gid=123456`), and
 * browsers never send fragments to a server. A route that took the whole URL
 * would silently import the first tab every time.
 */

export type SheetReference = {
  /** The document id from /d/{id}/, or the publish token from /d/e/{token}/. */
  sheetId: string;
  /** The tab. Absent means the first one. */
  gid?: string;
  /** True for a /d/e/… "publish to web" link, which uses a different export path. */
  published: boolean;
};

export type SheetUrlResult =
  | { ok: true; reference: SheetReference }
  | { ok: false; message: string };

const SHEET_ID = /^[A-Za-z0-9-_]+$/;

export function parseSheetUrl(input: string): SheetUrlResult {
  const trimmed = input.trim();

  if (!trimmed) {
    return { ok: false, message: "Paste the link to your Google Sheet." };
  }

  let url: URL;
  try {
    url = new URL(trimmed.includes("://") ? trimmed : `https://${trimmed}`);
  } catch {
    return {
      ok: false,
      message: "That isn't a link. Copy the address from your browser's bar and paste it here.",
    };
  }

  if (url.hostname !== "docs.google.com") {
    return {
      ok: false,
      message:
        "That's not a Google Sheets link. Open your sheet, copy the address from your browser's bar, and paste it here.",
    };
  }

  const path = url.pathname;

  // "Publish to web" links carry a token rather than the document id, and export
  // from /pub instead of /export. Matched first because /d/e/ also matches /d/.
  const publishedId = /\/spreadsheets\/d\/e\/([A-Za-z0-9-_]+)/.exec(path)?.[1];
  const documentId = /\/spreadsheets\/d\/([A-Za-z0-9-_]+)/.exec(path)?.[1];

  const sheetId = publishedId ?? documentId;

  if (!sheetId || !SHEET_ID.test(sheetId)) {
    return {
      ok: false,
      message:
        "We couldn't find a sheet in that link. It should look like docs.google.com/spreadsheets/d/…",
    };
  }

  return {
    ok: true,
    reference: {
      sheetId,
      gid: readGid(url),
      published: Boolean(publishedId),
    },
  };
}

/**
 * The tab id, from wherever this particular link shape put it.
 *
 * A normal share link uses the fragment; an already-exported or published link
 * uses the query string. Both are common because both are things people copy.
 */
function readGid(url: URL): string | undefined {
  const fromQuery = url.searchParams.get("gid");
  if (fromQuery && /^\d+$/.test(fromQuery)) return fromQuery;

  const fromHash = /(?:^#|[#&])gid=(\d+)/.exec(url.hash)?.[1];
  return fromHash ?? undefined;
}
