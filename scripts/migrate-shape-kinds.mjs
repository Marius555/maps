/**
 * One-shot: widen the `shapes.kind` enum so lines can be saved.
 *
 *   npm run migrate:shape-kinds
 *
 * `setup-appwrite.mjs` creates whatever is missing and, by design, never alters
 * an existing column — see its header. That is the right default: a script that
 * quietly rewrites live columns is a script that can quietly lose data. But it
 * means adding a value to an enum is invisible to it. On a deployment created
 * before lines existed, `kind` still allows only "circle" and "polygon", and
 * every attempt to save a line fails at the database with an error that says
 * nothing about enums.
 *
 * So this exists, and has to be run once per environment before deploying lines.
 *
 * Safe to re-run: an enum that already carries every value in the schema is left
 * alone and reported as a skip.
 *
 * Widening only. Appwrite's updateEnumColumn replaces the element list outright,
 * so this refuses to run if the deployed column has a value the schema does not
 * — that is either a newer deployment than this checkout or a hand edit, and
 * either way dropping it would orphan real rows.
 */

import { Client, TablesDB } from "node-appwrite";
import { SHAPE_KINDS, TABLES } from "./appwrite-schema.mjs";

const REQUIRED_ENV = [
  "NEXT_PUBLIC_APPWRITE_ENDPOINT",
  "NEXT_PUBLIC_APPWRITE_PROJECT_ID",
  "APPWRITE_API_KEY",
  "DATABASE_ID",
];

const missing = REQUIRED_ENV.filter((key) => !process.env[key]);
if (missing.length > 0) {
  console.error(`Missing environment variables: ${missing.join(", ")}`);
  console.error("Add them to .env, then run npm run migrate:shape-kinds again.");
  process.exit(1);
}

const DATABASE_ID = process.env.DATABASE_ID;

// TABLES is the schema's array of table definitions, not a lookup by name.
const shapes = TABLES.find((table) => table.id === "shapes");

if (!shapes) {
  console.error("No 'shapes' table in scripts/appwrite-schema.mjs.");
  process.exit(1);
}

const column = shapes.columns.find((entry) => entry.key === "kind");

if (!column || column.type !== "enum") {
  console.error("'shapes.kind' is not an enum in scripts/appwrite-schema.mjs.");
  process.exit(1);
}

const client = new Client()
  .setEndpoint(process.env.NEXT_PUBLIC_APPWRITE_ENDPOINT)
  .setProject(process.env.NEXT_PUBLIC_APPWRITE_PROJECT_ID)
  .setKey(process.env.APPWRITE_API_KEY);

const tablesDB = new TablesDB(client);

console.log(`Widening shapes.kind to: ${SHAPE_KINDS.join(", ")}\n`);

let deployed;
try {
  deployed = await tablesDB.getColumn({
    databaseId: DATABASE_ID,
    tableId: shapes.id,
    key: "kind",
  });
} catch (error) {
  if (error?.code === 404) {
    console.error("  FAIL    shapes.kind does not exist yet.");
    console.error("          Run npm run setup:appwrite first.");
    process.exit(1);
  }
  throw error;
}

const present = new Set(deployed.elements ?? []);
const wanted = new Set(SHAPE_KINDS);

const lost = [...present].filter((value) => !wanted.has(value));
if (lost.length > 0) {
  console.error(`  FAIL    the deployed column has values this schema drops: ${lost.join(", ")}`);
  console.error("          Refusing to run — rows using them would be orphaned.");
  process.exit(1);
}

const added = SHAPE_KINDS.filter((value) => !present.has(value));

if (added.length === 0) {
  console.log("  SKIP    shapes.kind already allows every value.");
  process.exit(0);
}

await tablesDB.updateEnumColumn({
  databaseId: DATABASE_ID,
  tableId: shapes.id,
  key: "kind",
  elements: SHAPE_KINDS,
  // Carried over from the deployed column rather than re-asserted from the
  // schema: this migration widens a value list and must not quietly flip a
  // column's nullability or default on the way past.
  required: deployed.required,
  /*
   * Explicitly null, never undefined.
   *
   * The SDK treats `xdefault` as a required *parameter* even for a required
   * column, which cannot have a default at all — so leaving it off fails
   * client-side with "Missing required parameter" before a request is made.
   * `null` is how you say "no default" and is what the column already carries.
   */
  xdefault: deployed.default ?? null,
});

console.log(`  OK      added ${added.join(", ")}`);
