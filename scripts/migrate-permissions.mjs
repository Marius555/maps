/**
 * Take every user write permission off every row and file.
 *
 *   npm run migrate:permissions -- --dry-run
 *   npm run migrate:permissions
 *
 * ## Why
 *
 * Rows used to be created with `read`, `update` and `delete` for their owner, and
 * uploaded images with `update` and `delete`. Nothing in the app used them —
 * every read and write goes through the admin client — but the session cookie is
 * the real Appwrite session secret, so an owner who copied it out of devtools
 * could call Appwrite's API directly with exactly those rights. That made a
 * `subscriptions` row a user-editable plan, `places.mapId` a way round the
 * per-map limit, and `photoIds` a way to delete somebody else's file through our
 * own photo route. `ownerPermissions` returns `[]` now; this does the rows that
 * already exist.
 *
 * Rows end with no permissions at all. Files keep their `read(...)` entries —
 * photos, logos and snapshots are read by strangers' browsers straight from
 * storage (§2) — and lose everything else.
 *
 * Safe to re-run: a row or file that already has what it should is skipped.
 *
 * It used to have a `--verify-subscriptions` mode that asked Lemon Squeezy
 * whether any subscription row had been edited by its owner. It was a one-off
 * check, it spoke only Lemon's API, and every Lemon row was test data dropped
 * with the move to Stripe (November 2026), so it went with it.
 */

import { Client, Query, Storage, TablesDB } from "node-appwrite";

const REQUIRED_ENV = [
  "NEXT_PUBLIC_APPWRITE_ENDPOINT",
  "NEXT_PUBLIC_APPWRITE_PROJECT_ID",
  "APPWRITE_API_KEY",
  "DATABASE_ID",
  "STORAGE_ID",
];

const missing = REQUIRED_ENV.filter((key) => !process.env[key]);
if (missing.length > 0) {
  console.error(`Missing environment variables: ${missing.join(", ")}`);
  console.error("Add them to .env, then run npm run migrate:permissions again.");
  process.exit(1);
}

const DATABASE_ID = process.env.DATABASE_ID;
const PAGE_SIZE = 100;

/**
 * Every table a row was ever created in with `ownerPermissions` — and the two
 * team tables, which never had any, listed so a run proves they still have none.
 */
const OWNED_TABLES = [
  "maps",
  "places",
  "shapes",
  "groups",
  "sheetLinks",
  "cardDesigns",
  "subscriptions",
  "memberships",
  "invites",
];

const BUCKETS = [
  ...new Set([process.env.STORAGE_ID, process.env.SNAPSHOT_STORAGE_ID].filter(Boolean)),
];

const dryRun = process.argv.includes("--dry-run");

const client = new Client()
  .setEndpoint(process.env.NEXT_PUBLIC_APPWRITE_ENDPOINT)
  .setProject(process.env.NEXT_PUBLIC_APPWRITE_PROJECT_ID)
  .setKey(process.env.APPWRITE_API_KEY);

const tablesDB = new TablesDB(client);
const storage = new Storage(client);

let failed = 0;

await stripRows();
await stripFiles();

process.exit(failed > 0 ? 1 : 0);

async function stripRows() {
  console.log(dryRun ? "Dry run: nothing will be written.\n" : "Stripping row permissions.\n");

  for (const tableId of OWNED_TABLES) {
    let changed = 0;
    let seen = 0;

    try {
      for await (const row of allRows(tableId)) {
        seen += 1;
        if ((row.$permissions ?? []).length === 0) continue;

        if (!dryRun) {
          try {
            await tablesDB.updateRow({
              databaseId: DATABASE_ID,
              tableId,
              rowId: row.$id,
              data: {},
              permissions: [],
            });
          } catch (error) {
            failed += 1;
            console.error(`  failed  ${tableId}/${row.$id} — ${error.message}`);
            continue;
          }
        }

        changed += 1;
      }
    } catch (error) {
      failed += 1;
      console.error(`  failed  ${tableId} — ${error.message}`);
      continue;
    }

    console.log(
      `  ${tableId.padEnd(14)} ${changed} of ${seen} rows ${dryRun ? "would be" : ""} stripped`,
    );
  }
}

async function stripFiles() {
  for (const bucketId of BUCKETS) {
    let changed = 0;
    let seen = 0;

    try {
      for await (const file of allFiles(bucketId)) {
        seen += 1;

        const current = file.$permissions ?? [];
        const next = current.filter((permission) => permission.startsWith("read("));

        if (next.length === current.length) continue;

        if (!dryRun) {
          try {
            await storage.updateFile({ bucketId, fileId: file.$id, permissions: next });
          } catch (error) {
            failed += 1;
            console.error(`  failed  file ${file.$id} — ${error.message}`);
            continue;
          }
        }

        changed += 1;
      }
    } catch (error) {
      failed += 1;
      console.error(`  failed  bucket ${bucketId} — ${error.message}`);
      continue;
    }

    console.log(
      `  bucket ${bucketId}: ${changed} of ${seen} files ${dryRun ? "would be" : ""} stripped`,
    );
  }
}

/* ---------- paging ---------- */

async function* allRows(tableId) {
  let cursor = null;

  for (;;) {
    const queries = [Query.limit(PAGE_SIZE), Query.orderAsc("$id")];
    if (cursor) queries.push(Query.cursorAfter(cursor));

    const { rows } = await tablesDB.listRows({ databaseId: DATABASE_ID, tableId, queries });

    if (rows.length === 0) return;

    yield* rows;

    if (rows.length < PAGE_SIZE) return;
    cursor = rows[rows.length - 1].$id;
  }
}

async function* allFiles(bucketId) {
  let cursor = null;

  for (;;) {
    const queries = [Query.limit(PAGE_SIZE), Query.orderAsc("$id")];
    if (cursor) queries.push(Query.cursorAfter(cursor));

    const { files } = await storage.listFiles({ bucketId, queries });

    if (files.length === 0) return;

    yield* files;

    if (files.length < PAGE_SIZE) return;
    cursor = files[files.length - 1].$id;
  }
}
