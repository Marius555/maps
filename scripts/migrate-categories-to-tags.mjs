/**
 * Fold every map's categories into its tags, and every place's category into
 * its tag list.
 *
 *   npm run migrate:tags -- --dry-run
 *   npm run migrate:tags
 *
 * Categories and tags asked the same question under two names. A category
 * coloured the pin, so a location had exactly one; a tag said what a location
 * offered, so it had as many as applied — and the *less* capable of the two was
 * the one every owner reached for first, because it was the one that changed
 * what the map looked like. Tags absorbed it: a tag carries a colour now, and a
 * location's first tag is what its pin is drawn in
 * (lib/validation/tag.schema.ts).
 *
 * **The trick that makes this cheap and lossless: a category becomes a tag that
 * keeps its own id.** `places.category` already holds `cat-xxxx`, so minting the
 * tag as `{ id: "cat-xxxx", label, color }` makes folding it into `places.tags`
 * an array write with no id remapping anywhere — and putting it *first* means
 * every pin on every existing map comes out the exact colour it is today.
 *
 * That is the one id in the system that breaks `newTagId`'s "never reuse an id"
 * rule, and it is safe only because categories are retired: nothing will ever
 * mint a `cat-` id again, so it cannot collide with anything past or future.
 *
 * Safe to re-run. A map whose category ids are already tag ids is skipped, and a
 * place is only written when its `category` is set. A second run prints skips.
 *
 * `--dry-run` writes nothing and prints what it would do. Worth doing first: a
 * map that will not fit the tag ceilings is *reported*, never truncated, and the
 * report is the only chance to decide what to do about it before anything moves.
 *
 * **It does not republish.** Live snapshots keep the `categories` they were
 * published with, and the embed still reads them (§7). Publishing again is what
 * moves a map onto the new fields, and that is the owner's call.
 *
 * Nothing here drops a column. `maps.categories` is emptied per map once its
 * categories are tags; `places.category` is cleared per row. Both columns stay
 * in scripts/appwrite-schema.mjs, marked retired — a column with data in it is
 * not something a migration gets to delete.
 */

import { Client, Query, TablesDB } from "node-appwrite";

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
  console.error("Add them to .env, then run npm run migrate:tags again.");
  process.exit(1);
}

const DATABASE_ID = process.env.DATABASE_ID;
const PAGE_SIZE = 100;

/*
 * Mirrors lib/validation/tag.schema.ts. Duplicated rather than imported because
 * this is a plain .mjs script and that file is TypeScript behind a bundler — the
 * same trade `scripts/build-gazetteer.mjs` makes. The numbers are only ever read
 * here to *report* a map that will not fit; nothing is silently truncated, so a
 * copy that drifts costs a misleading warning rather than lost data.
 */
const MAX_TAG_GROUPS = 6;
const MAX_TAGS_PER_GROUP = 24;
const MAX_TAGS_TOTAL = 60;

/** The group migrated categories land in. Named for what they were. */
const GROUP_LABEL = "Categories";

const MAPS_TABLE = TABLES.find((table) => table.id === "maps")?.id;
const PLACES_TABLE = TABLES.find((table) => table.id === "places")?.id;

if (!MAPS_TABLE || !PLACES_TABLE) {
  console.error("No 'maps' or 'places' table in scripts/appwrite-schema.mjs.");
  process.exit(1);
}

const dryRun = process.argv.includes("--dry-run");

const client = new Client()
  .setEndpoint(process.env.NEXT_PUBLIC_APPWRITE_ENDPOINT)
  .setProject(process.env.NEXT_PUBLIC_APPWRITE_PROJECT_ID)
  .setKey(process.env.APPWRITE_API_KEY);

const tablesDB = new TablesDB(client);

const stats = {
  maps: 0,
  mapsSkipped: 0,
  tags: 0,
  places: 0,
  overflowed: 0,
  failed: 0,
};

console.log(
  dryRun
    ? "Dry run: nothing will be written."
    : "Folding categories into tags.",
);
console.log("");

for await (const map of allRows(MAPS_TABLE, [])) {
  const label = `${map.name} (${map.$id})`;

  try {
    const categories = parseJson(map.categories, []);
    const tagGroups = parseJson(map.tagGroups, []);

    /*
     * Already migrated, or nothing to migrate.
     *
     * The id test is what makes a second run a no-op rather than a second
     * "Categories" group: a category that has become a tag is findable by its
     * own id, because that is the whole point of keeping it.
     */
    const known = new Set(
      tagGroups.flatMap((group) => (group.tags ?? []).map((tag) => tag.id)),
    );
    const pending = categories.filter((category) => !known.has(category.id));

    if (pending.length === 0) {
      stats.mapsSkipped += 1;
      // Still worth clearing: a map migrated by an earlier run that failed
      // between the two writes would otherwise keep its categories forever.
      if (categories.length > 0 && !dryRun) {
        await tablesDB.updateRow({
          databaseId: DATABASE_ID,
          tableId: MAPS_TABLE,
          rowId: map.$id,
          data: { categories: "[]" },
        });
      }
      continue;
    }

    /*
     * Reported, never truncated. A map at a ceiling is a map whose owner has to
     * decide what to lose, and a script that decides for them loses the one
     * thing they cannot get back.
     */
    const total = countTags(tagGroups) + pending.length;
    const problem = ceilingProblem(tagGroups, pending.length, total);

    if (problem) {
      stats.overflowed += 1;
      console.log(`  skip    ${label} — ${problem}`);
      continue;
    }

    const nextGroups = [
      ...tagGroups,
      {
        id: `grp-${randomSuffix()}`,
        label: uniqueLabel(GROUP_LABEL, tagGroups),
        // The category's own id, kept — see the header. This is what lets the
        // place loop below fold `category` into `tags` with no remapping.
        tags: pending.map((category) => ({
          id: category.id,
          label: category.label,
          color: category.color,
        })),
      },
    ];

    if (!dryRun) {
      await tablesDB.updateRow({
        databaseId: DATABASE_ID,
        tableId: MAPS_TABLE,
        rowId: map.$id,
        data: { tagGroups: JSON.stringify(nextGroups), categories: "[]" },
      });
    }

    stats.maps += 1;
    stats.tags += pending.length;
    console.log(
      `  ${dryRun ? "would  " : "moved  "} ${label} — ${pending.length} ` +
        `${pending.length === 1 ? "category" : "categories"} into "${GROUP_LABEL}"`,
    );

    stats.places += await migratePlaces(map.$id);
  } catch (error) {
    stats.failed += 1;
    console.error(`  failed  ${label} — ${error.message}`);
  }
}

console.log("");
console.log(
  `${stats.maps} ${dryRun ? "maps to migrate" : "maps migrated"}, ` +
    `${stats.tags} tags, ${stats.places} locations retagged, ` +
    `${stats.mapsSkipped} already done, ${stats.overflowed} over a ceiling, ` +
    `${stats.failed} failed.`,
);

if (stats.overflowed > 0) {
  console.log("");
  console.log("Maps over a ceiling were left alone. Remove some tags in");
  console.log("Settings → Filters on those maps, then run this again.");
}

if (stats.maps > 0 && !dryRun) {
  console.log("");
  console.log("Nothing was republished. A live embed keeps drawing what it was");
  console.log("published with until its owner presses Publish again.");
}

process.exit(stats.failed > 0 ? 1 : 0);

/**
 * Every place on this map that still has a category, with it moved to the front
 * of its tags.
 *
 * **First**, and that is the whole reason the pin colours do not move: the
 * renderers take the location's first tag, which is exactly what the category
 * was. A place already wearing that id keeps one copy — the filter is what makes
 * a re-run safe on a row the first run got to before it failed.
 *
 * Paging while writing is safe here even though each write drops the row out of
 * the filter: the cursor is `$id` ascending, so every page asks for ids *after*
 * the last one handled, and a row this loop has already cleared is behind the
 * cursor either way. Appwrite resolves the cursor by id, so the row it names not
 * matching the filter any more does not lose our place.
 */
async function migratePlaces(mapId) {
  let migrated = 0;

  for await (const place of allRows(PLACES_TABLE, [
    Query.equal("mapId", mapId),
    Query.notEqual("category", ""),
  ])) {
    const tags = [
      place.category,
      ...(place.tags ?? []).filter((id) => id !== place.category),
    ];

    if (!dryRun) {
      await tablesDB.updateRow({
        databaseId: DATABASE_ID,
        tableId: PLACES_TABLE,
        rowId: place.$id,
        data: { tags, category: "" },
      });
    }

    migrated += 1;
  }

  return migrated;
}

/** Which ceiling this map would break, in the sentence the owner needs. */
function ceilingProblem(groups, adding, total) {
  if (groups.length >= MAX_TAG_GROUPS) {
    return `already has ${MAX_TAG_GROUPS} filter groups, so there is no room for one more`;
  }

  if (adding > MAX_TAGS_PER_GROUP) {
    return `has ${adding} categories and a group holds ${MAX_TAGS_PER_GROUP}`;
  }

  if (total > MAX_TAGS_TOTAL) {
    return `would end up with ${total} tags and the ceiling is ${MAX_TAGS_TOTAL}`;
  }

  return null;
}

/**
 * "Categories", or "Categories 2" if that name is taken.
 *
 * Group labels have to be unique (`tagGroupsSchema`), and a map whose owner
 * already made a group called Categories would otherwise fail to save the moment
 * they next opened Settings — a failure with no visible cause, hours later.
 */
function uniqueLabel(base, groups) {
  const taken = new Set(groups.map((group) => (group.label ?? "").toLowerCase()));
  if (!taken.has(base.toLowerCase())) return base;

  for (let suffix = 2; suffix < 100; suffix += 1) {
    const candidate = `${base} ${suffix}`;
    if (!taken.has(candidate.toLowerCase())) return candidate;
  }

  return `${base} ${Date.now()}`;
}

function countTags(groups) {
  return groups.reduce((total, group) => total + (group.tags ?? []).length, 0);
}

function randomSuffix() {
  return crypto.randomUUID().slice(0, 8);
}

function parseJson(value, fallback) {
  if (!value) return fallback;

  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed) ? parsed : fallback;
  } catch {
    return fallback;
  }
}

/** Cursor pagination: Appwrite caps a page at 100 rows (CLAUDE.md §7). */
async function* allRows(tableId, filters) {
  let cursor = null;

  for (;;) {
    const queries = [...filters, Query.limit(PAGE_SIZE), Query.orderAsc("$id")];
    if (cursor) queries.push(Query.cursorAfter(cursor));

    const { rows } = await tablesDB.listRows({
      databaseId: DATABASE_ID,
      tableId,
      queries,
    });

    if (rows.length === 0) return;

    yield* rows;

    if (rows.length < PAGE_SIZE) return;
    cursor = rows[rows.length - 1].$id;
  }
}
