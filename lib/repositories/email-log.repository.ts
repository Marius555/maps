import "server-only";

import { ID, Query, type Models } from "node-appwrite";

import { admin } from "@/lib/appwrite/admin";
import { TABLES } from "@/lib/appwrite/config";
import { env } from "@/lib/env";

/**
 * One row per transactional email we tried to send, for the operator console.
 *
 * Written by `sendEmail` alone and read by the console alone. The recipient
 * arrives already masked (`lib/email/mask.ts`) — this table never holds a
 * whole address.
 */

export type EmailLogEntry = {
  sentAt: string;
  day: string;
  template: string;
  ok: boolean;
  error: string | null;
  recipient: string;
  subject: string;
};

type EmailLogRow = Models.Row & {
  sentAt: string;
  day: string;
  template: string;
  ok?: boolean | null;
  error?: string | null;
  recipient?: string | null;
  subject?: string | null;
};

export async function writeEmailLog(entry: EmailLogEntry): Promise<void> {
  await admin.tablesDB.createRow({
    databaseId: env.databaseId,
    tableId: TABLES.emailLog,
    rowId: ID.unique(),
    data: {
      ...entry,
      error: entry.error?.slice(0, 200) ?? null,
      subject: entry.subject.slice(0, 200),
    },
  });
}

/**
 * Every row sent on or after `fromDay`, newest first, up to `cap`.
 *
 * Capped rather than unbounded because this is read on a page load inside a
 * 30-second host limit; the footer of the table says when it bound.
 */
export async function listEmailLog(
  fromDay: string,
  cap = 5_000,
): Promise<{ rows: EmailLogEntry[]; truncated: boolean }> {
  const rows: EmailLogEntry[] = [];
  let cursor: string | undefined;

  while (rows.length < cap) {
    const result = await admin.tablesDB.listRows<EmailLogRow>({
      databaseId: env.databaseId,
      tableId: TABLES.emailLog,
      queries: [
        // Filtered and ordered on the one column, so one index answers both.
        Query.greaterThanEqual("sentAt", `${fromDay}T00:00:00.000Z`),
        Query.orderDesc("sentAt"),
        Query.limit(500),
        ...(cursor ? [Query.cursorAfter(cursor)] : []),
      ],
    });

    for (const row of result.rows) {
      rows.push({
        sentAt: row.sentAt,
        day: row.day,
        template: row.template,
        ok: row.ok ?? false,
        error: row.error ?? null,
        recipient: row.recipient ?? "",
        subject: row.subject ?? "",
      });
    }

    if (result.rows.length < 500) return { rows, truncated: false };
    cursor = result.rows[result.rows.length - 1].$id;
  }

  return { rows: rows.slice(0, cap), truncated: true };
}
