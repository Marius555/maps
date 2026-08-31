/**
 * Move already-published maps onto whichever tile host the app now points at.
 *
 *   npm run migrate:style-host
 *   npm run migrate:style-host -- --dry-run
 *
 * The step nobody remembers, and the one that decides whether the switch took
 * effect. `styleUrl` is resolved at publish time and baked into each snapshot —
 * that is exactly what makes changing tile hosts a republish rather than a
 * redeploy of every customer's embed (packages/shared/snapshot.ts). It also means
 * setting NEXT_PUBLIC_TILES_URL moves *new* publishes only. Every map already live
 * on a customer's site keeps fetching the old host forever: a dependency you
 * believed you had removed, still sitting in front of real visitors.
 *
 * So this walks the published maps and rewrites their live snapshot: `styleUrl` to
 * the host the app is now configured for, `attribution` to the credit that host is
 * owed. Everything else is left exactly as published — it is not a republish, it
 * does not re-read places, and it does not touch `publishedAt`. The content did not
 * change; the tile host did.
 *
 * **It runs in both directions.** The target is read from the environment and the
 * *current* basemap is read out of each snapshot's own URL, so unsetting
 * NEXT_PUBLIC_TILES_URL and running this again walks everything back to
 * OpenFreeMap. A switch you cannot reverse is one nobody dares make.
 *
 * Safe to re-run: a snapshot already on the target is skipped, and one whose URL
 * names no basemap we know is reported rather than guessed at. A second run prints
 * nothing but skips.
 *
 * `--dry-run` prints exactly which maps would move and to what, and writes
 * nothing. Worth doing first every time: these files are what real visitors on
 * real customer sites are fetching right now.
 *
 * Run it *after* the styles are uploaded and reachable. The check at the top
 * fetches every URL it is about to write, because pointing live customer maps at a
 * 404 is the one outcome worth going out of the way to avoid.
 */

import { Client, ID, Permission, Query, Role, Storage, TablesDB } from "node-appwrite";

import { TABLES } from "./appwrite-schema.mjs";
import {
  attributionFor,
  BASEMAP_SOURCES,
  sourceOfStyleUrl,
  styleUrlFor,
} from "./tile-style.mjs";

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
  console.error("Add them to .env, then run npm run migrate:style-host again.");
  process.exit(1);
}

const DATABASE_ID = process.env.DATABASE_ID;
const BUCKET_ID = process.env.SNAPSHOT_STORAGE_ID || process.env.STORAGE_ID;
const ENDPOINT = process.env.NEXT_PUBLIC_APPWRITE_ENDPOINT;
const PROJECT_ID = process.env.NEXT_PUBLIC_APPWRITE_PROJECT_ID;

/*
 * Read rather than passed as an argument, on purpose: the snapshots have to end
 * up pointing wherever the app is now configured to look, and two sources of that
 * answer is exactly how they come to disagree. Unset is a legitimate setting — it
 * means OpenFreeMap, and it is what a rollback looks like.
 */
const TILE_BASE = (process.env.NEXT_PUBLIC_TILES_URL ?? "").replace(/\/+$/, "");

const PAGE_SIZE = 100;
/** Appwrite's ceiling for a file id — mirrors lib/snapshot/storage.ts. */
const MAX_FILE_ID = 36;

const MAPS_TABLE = TABLES.find((table) => table.id === "maps")?.id;

if (!MAPS_TABLE) {
  console.error("No 'maps' table in scripts/appwrite-schema.mjs.");
  process.exit(1);
}

const ATTRIBUTION = attributionFor(TILE_BASE);
const dryRun = process.argv.includes("--dry-run");

console.log(
  TILE_BASE
    ? `Moving published maps onto ${TILE_BASE}.`
    : "NEXT_PUBLIC_TILES_URL is unset: moving published maps back to OpenFreeMap.",
);
console.log("");
console.log(`Checking the ${BASEMAP_SOURCES.length} style URLs before rewriting anything…`);

let unreachable = 0;
for (const source of BASEMAP_SOURCES) {
  const url = styleUrlFor(source, TILE_BASE);

  try {
    const response = await fetch(url);
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    console.log(`  ok    ${url}`);
  } catch (error) {
    unreachable += 1;
    console.error(`  FAIL  ${url} — ${error.message}`);
  }
}

if (unreachable > 0) {
  console.error("");
  console.error("Upload public/tiles/ to the bucket first. Pointing live customer");
  console.error("maps at a style that 404s is the one outcome worth avoiding here.");
  process.exit(1);
}

const client = new Client()
  .setEndpoint(ENDPOINT)
  .setProject(PROJECT_ID)
  .setKey(process.env.APPWRITE_API_KEY);

const tablesDB = new TablesDB(client);
const storage = new Storage(client);

const stats = { moved: 0, already: 0, unknown: 0, unpublished: 0, failed: 0 };

console.log("");
console.log(dryRun ? "Dry run: nothing will be written." : "Rewriting published snapshots.");
console.log("");

for await (const map of allMaps()) {
  const label = `${map.name} (${map.$id})`;

  if (!map.publishedAt) {
    stats.unpublished += 1;
    continue;
  }

  try {
    const fileId = liveFileId(map.$id);
    const snapshot = await readSnapshot(fileId);
    const source = sourceOfStyleUrl(snapshot.styleUrl);

    if (!source) {
      stats.unknown += 1;
      console.log(`  skip    ${label} — unrecognised styleUrl ${snapshot.styleUrl}`);
      continue;
    }

    const styleUrl = styleUrlFor(source, TILE_BASE);

    if (styleUrl === snapshot.styleUrl && snapshot.attribution === ATTRIBUTION) {
      stats.already += 1;
      continue;
    }

    if (!dryRun) {
      await writeSnapshot(map.$id, fileId, {
        ...snapshot,
        styleUrl,
        attribution: ATTRIBUTION,
      });
    }

    stats.moved += 1;
    console.log(`  ${dryRun ? "would  " : "moved  "} ${label}`);
    console.log(`            ${snapshot.styleUrl}`);
    console.log(`         -> ${styleUrl}`);
  } catch (error) {
    stats.failed += 1;
    console.error(`  failed  ${label} — ${error.message}`);
  }
}

console.log("");
console.log(
  `${stats.moved} ${dryRun ? "to move" : "moved"}, ${stats.already} already there, ` +
    `${stats.unknown} unrecognised, ${stats.unpublished} never published, ` +
    `${stats.failed} failed.`,
);

process.exit(stats.failed > 0 ? 1 : 0);

/** Mirrors `liveFileId` in lib/snapshot/storage.ts. */
function liveFileId(mapId) {
  return `live-${mapId}`.slice(0, MAX_FILE_ID);
}

async function readSnapshot(fileId) {
  const url =
    `${ENDPOINT}/storage/buckets/${BUCKET_ID}/files/${fileId}/view` +
    `?project=${PROJECT_ID}`;

  const response = await fetch(url);
  if (!response.ok) throw new Error(`live snapshot returned HTTP ${response.status}`);

  return response.json();
}

/**
 * Archive first, then replace the live file — the order `uploadSnapshot` uses, and
 * for the same reason: if anything after the archive fails, the rewritten content
 * still exists and the previous live file is untouched.
 *
 * The archive is written because §7 wants every published state recoverable, and a
 * live file quietly rewritten with nothing behind it breaks that promise.
 */
async function writeSnapshot(mapId, fileId, snapshot) {
  const body = JSON.stringify(snapshot);
  const stamp = new Date().toISOString().replace(/[:.]/g, "-");

  await storage.createFile({
    bucketId: BUCKET_ID,
    fileId: ID.unique(),
    file: asFile(body, `${mapId}-${stamp}.json`),
    permissions: [Permission.read(Role.any())],
  });

  // Delete-then-create: Appwrite Storage has no atomic overwrite. The window is
  // one upload long and the embed retries once, exactly as on a real publish.
  await removeFile(fileId);

  await storage.createFile({
    bucketId: BUCKET_ID,
    fileId,
    file: asFile(body, `${mapId}-live.json`),
    permissions: [Permission.read(Role.any())],
  });
}

function asFile(body, name) {
  return new File([body], name, { type: "application/json" });
}

async function removeFile(fileId) {
  try {
    await storage.deleteFile({ bucketId: BUCKET_ID, fileId });
  } catch {
    // Almost always "never existed", which readSnapshot would already have caught.
  }
}

/** Cursor pagination: Appwrite caps a page at 100 rows (CLAUDE.md §7). */
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
