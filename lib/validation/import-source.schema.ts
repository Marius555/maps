import { z } from "zod";

/**
 * What the Google Sheets fetch route accepts.
 *
 * Deliberately not a URL. The route builds the Google address itself from these
 * two pieces, so there is no path from user input to an arbitrary outbound
 * request — a route that fetched whatever URL it was handed would be an SSRF
 * hole with a friendly name. The client parses the pasted link into these
 * (lib/import/sheet-url.ts), which it has to do anyway because the sheet tab
 * lives in the URL fragment and never reaches a server.
 */
export const googleSheetSourceSchema = z.object({
  sheetId: z
    .string()
    .trim()
    .min(1, "Paste the link to your Google Sheet.")
    .max(200, "That doesn't look like a Google Sheets link.")
    .regex(/^[A-Za-z0-9-_]+$/, "That doesn't look like a Google Sheets link."),
  /** The tab. Absent means the first one. */
  gid: z
    .string()
    .trim()
    .regex(/^\d+$/, "That doesn't look like a Google Sheets link.")
    .max(20)
    .optional(),
  /** True for a "publish to web" link, which exports from a different path. */
  published: z.boolean().default(false),
});

export type GoogleSheetSourceInput = z.infer<typeof googleSheetSourceSchema>;
