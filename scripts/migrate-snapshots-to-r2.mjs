/**
 * Move already-published maps' snapshots from Appwrite Storage onto R2.
 *
 *   npm run migrate:snapshots-to-r2 -- --dry-run
 *   npm run migrate:snapshots-to-r2
 *
 * Setting SNAPSHOT_PUBLIC_URL moves *new* publishes only. A map published before
 * it keeps `snapshotUrl` pointing at Appwrite, which answers 403 to every
 * customer's origin — so until this runs, those maps work nowhere but the
 * dashboard's own preview.
 *
 * For each published map still on Appwrite: read the live snapshot exactly as
 * published, write it to R2 (archive, then live — the order uploadSnapshot uses),
 * fetch it back through the public URL *as a customer's page would*, with a
 * foreign Origin, and only then point `maps.snapshotUrl` at it.
 *
 * **It is not a republish.** Places are not re-read, so edits an owner has saved
 * but not published stay unpublished; the bytes are copied verbatim and
 * `publishedAt` is not touched. The Appwrite copies are left where they are, so
 * the move is reversible by pointing `snapshotUrl` back; deleting the map clears
 * both (lib/snapshot/storage.ts).
 *
 * Safe to re-run: a map already on SNAPSHOT_PUBLIC_URL is skipped. Stops at the
 * first map that fails the read-back, because that is a configuration problem
 * (npm run setup:r2) and every later map would fail the same way.
 */

import { Client, Query, TablesDB } from "node-appwrite";

import { TABLES } from "./appwrite-schema.mjs";
import { liveKey, publicUrl, R2_ENV, snapshotBucket, snapshotPublicUrl } from "./r2.mjs";

const REQUIRED_ENV = [
  "NEXT_PUBLIC_APPWRITE_ENDPOINT",
  "NEXT_PUBLIC_APPWRITE_PROJECT_ID",
  "APPWRITE_API_KEY",
  "DATABASE_ID",
  ...R2_ENV,
];

const missing = REQUIRED_ENV.filter((key) => !process.env[key]);
if (missing.length > 0) {
  console.error(`Missing environment variables: ${missing.join(", ")}`);
  console.error("Add them to .env, then run npm run migrate:snapshots-to-r2 again.");
  process.exit(1);
}

const PAGE_SIZE = 100;
/** Not a real site: any origin Appwrite has not registered, which is the point. */
const FOREIGN_ORIGIN = "https://some-customer-shop.example";

const MAPS_TABLE = TABLES.find((table) => table.id === "maps")?.id;
if (!MAPS_TABLE) {
  console.error("No 'maps' table in scripts/appwrite-schema.mjs.");
  process.exit(1);
}

const dryRun = process.argv.includes("--dry-run");
const base = snapshotPublicUrl();

const client = new Client()
  .setEndpoint(process.env.NEXT_PUBLIC_APPWRITE_ENDPOINT)
  .setProject(process.env.NEXT_PUBLIC_APPWRITE_PROJECT_ID)
  .setKey(process.env.APPWRITE_API_KEY);

const tablesDB = new TablesDB(client);
const bucket = snapshotBucket();
const stats = { moved: 0, already: 0, unpublished: 0, failed: 0 };

console.log(`Moving published snapshots onto ${base}.`);
console.log(dryRun ? "Dry run: nothing will be written." : "");

for await (const map of allMaps()) {
  const label = `${map.name} (${map.$id})`;

  if (!map.publishedAt || !map.snapshotUrl) {
    stats.unpublished += 1;
    continue;
  }

  if (map.snapshotUrl.startsWith(`${base}/`)) {
    stats.already += 1;
    continue;
  }

  let body;
  let snapshot;

  try {
    // Server to server, so no Origin header — the one way Appwrite still answers.
    const response = await fetch(map.snapshotUrl);
    if (!response.ok) throw new Error(`current snapshot returned HTTP ${response.status}`);

    body = await response.text();
    snapshot = JSON.parse(body);

    if (snapshot.version !== 1) throw new Error(`unknown snapshot version ${snapshot.version}`);
    if (snapshot.mapId !== map.$id) throw new Error(`snapshot belongs to map ${snapshot.mapId}`);
  } catch (error) {
    stats.failed += 1;
    console.error(`  failed  ${label} — ${error.message}`);
    continue;
  }

  const target = publicUrl(liveKey(map.$id));

  if (dryRun) {
    stats.moved += 1;
    console.log(`  would   ${label}`);
    console.log(`            ${map.snapshotUrl}`);
    console.log(`         -> ${target}`);
    continue;
  }

  try {
    await bucket.writeSnapshot(map.$id, body, snapshot.generatedAt);
    await readBack(target, snapshot.generatedAt);

    await tablesDB.updateRow({
      databaseId: process.env.DATABASE_ID,
      tableId: MAPS_TABLE,
      rowId: map.$id,
      data: { snapshotUrl: target },
    });

    stats.moved += 1;
    console.log(`  moved   ${label}`);
    console.log(`         -> ${target}`);
  } catch (error) {
    stats.failed += 1;
    console.error(`  failed  ${label} — ${error.message}`);
    console.error("");
    console.error("Stopping: the public URL is not serving what was written. Run");
    console.error("npm run setup:r2 and check it prints only `ok`, then run this again.");
    break;
  }
}

console.log("");
console.log(
  `${stats.moved} ${dryRun ? "to move" : "moved"}, ${stats.already} already on R2, ` +
    `${stats.unpublished} never published, ${stats.failed} failed.`,
);

process.exit(stats.failed > 0 ? 1 : 0);

/**
 * Fetches the object back the way a customer's page will: cross-origin, from the
 * public domain. Checks the CORS header and that it is this publish's content,
 * not a stale edge copy.
 */
async function readBack(url, generatedAt) {
  const response = await fetch(url, { headers: { Origin: FOREIGN_ORIGIN } });
  if (!response.ok) throw new Error(`${url} returned HTTP ${response.status}`);

  const acao = response.headers.get("access-control-allow-origin");
  if (acao !== "*") throw new Error(`${url} has Access-Control-Allow-Origin ${acao ?? "missing"}`);

  const served = await response.json();
  if (served.generatedAt !== generatedAt) {
    throw new Error(`${url} serves generatedAt ${served.generatedAt}, expected ${generatedAt}`);
  }
}

/** Cursor pagination: Appwrite caps a page at 100 rows (CLAUDE.md §7). */
async function* allMaps() {
  let cursor = null;

  for (;;) {
    const queries = [Query.limit(PAGE_SIZE), Query.orderAsc("$id")];
    if (cursor) queries.push(Query.cursorAfter(cursor));

    const { rows } = await tablesDB.listRows({
      databaseId: process.env.DATABASE_ID,
      tableId: MAPS_TABLE,
      queries,
    });

    if (rows.length === 0) return;

    yield* rows;

    if (rows.length < PAGE_SIZE) return;
    cursor = rows[rows.length - 1].$id;
  }
}
