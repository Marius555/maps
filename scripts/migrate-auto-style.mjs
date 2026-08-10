/**
 * One-shot: move unpublished maps onto the "auto" basemap.
 *
 *   npm run migrate:auto-style
 *
 * `auto` resolves against whoever is looking — the dashboard's theme in the
 * editor, the visitor's own `prefers-color-scheme` in a published embed — and is
 * now the default for new maps. This brings existing ones along.
 *
 * Only maps that have never been published are touched. A published map's live
 * embed is already serving a basemap to real visitors, and changing what that
 * looks like is its owner's call, not a migration's.
 *
 * Deliberately a command someone runs rather than a rewrite inside
 * lib/repositories/mappers.ts. The column cannot tell "never chose a basemap"
 * apart from "chose Liberty on purpose", so a write-on-read would silently
 * overrule a real decision. This does move an unpublished map that was set to
 * something else deliberately — which is why it is opt-in, prints every change,
 * and can simply not be run.
 *
 * Safe to re-run: maps already on `auto` are skipped, so a second run should
 * print nothing but skips.
 */

import { Client, TablesDB, Query } from "node-appwrite";
import { TABLES } from "./appwrite-schema.mjs";

const REQUIRED_ENV = [
  "NEXT_PUBLIC_APPWRITE_ENDPOINT",
  "NEXT_PUBLIC_APPWRITE_PROJECT_ID",
  "APPWRITE_API_KEY",
  "DATABASE_ID",
];

const missing = REQUIRED_ENV.filter((key) => !process.env[key]);
if (missing.length > 0) {
  console.error(`Missing environment variables: ${missing.join(", ")}`);
  console.error("Add them to .env, then run npm run migrate:auto-style again.");
  process.exit(1);
}

const DATABASE_ID = process.env.DATABASE_ID;
const TARGET_STYLE = "auto";
const PAGE_SIZE = 100;

// TABLES is the schema's array of table definitions, not a lookup by name.
const MAPS_TABLE = TABLES.find((table) => table.id === "maps")?.id;

if (!MAPS_TABLE) {
  console.error("No 'maps' table in scripts/appwrite-schema.mjs.");
  process.exit(1);
}

const client = new Client()
  .setEndpoint(process.env.NEXT_PUBLIC_APPWRITE_ENDPOINT)
  .setProject(process.env.NEXT_PUBLIC_APPWRITE_PROJECT_ID)
  .setKey(process.env.APPWRITE_API_KEY);

const tablesDB = new TablesDB(client);

const stats = { moved: 0, skipped: 0, published: 0, failed: 0 };

/**
 * Cursor pagination, not offset: Appwrite caps a page at 100 rows (CLAUDE.md §7)
 * and rows are being updated as we walk, which offsets would skip over.
 */
async function* allMaps() {
  let cursor = null;

  for (;;) {
    const queries = [Query.limit(PAGE_SIZE), Query.orderAsc("$id")];
    if (cursor) queries.push(Query.cursorAfter(cursor));

    const { rows } = await tablesDB.listRows({
      databaseId: DATABASE_ID,
      tableId: MAPS_TABLE,
      queries,
    });

    if (rows.length === 0) return;

    yield* rows;

    if (rows.length < PAGE_SIZE) return;
    cursor = rows[rows.length - 1].$id;
  }
}

console.log(`Moving unpublished maps to the "${TARGET_STYLE}" basemap.\n`);

for await (const map of allMaps()) {
  const label = `${map.name} (${map.$id})`;

  if (map.publishedAt) {
    stats.published += 1;
    console.log(`  keep    ${label} — published, still on "${map.style}"`);
    continue;
  }

  if (map.style === TARGET_STYLE) {
    stats.skipped += 1;
    console.log(`  skip    ${label} — already "${TARGET_STYLE}"`);
    continue;
  }

  try {
    await tablesDB.updateRow({
      databaseId: DATABASE_ID,
      tableId: MAPS_TABLE,
      rowId: map.$id,
      data: { style: TARGET_STYLE },
    });

    stats.moved += 1;
    console.log(`  moved   ${label} — "${map.style}" → "${TARGET_STYLE}"`);
  } catch (error) {
    stats.failed += 1;
    console.error(`  failed  ${label} — ${error.message}`);
  }
}

console.log(
  `\n${stats.moved} moved, ${stats.skipped} already set, ` +
    `${stats.published} left published, ${stats.failed} failed.`,
);

process.exit(stats.failed > 0 ? 1 : 0);
