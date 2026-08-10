/**
 * Idempotent Appwrite provisioner.
 *
 *   npm run setup:appwrite
 *
 * Creates the database, tables, columns, indexes and storage bucket described by
 * appwrite-schema.mjs. Safe to re-run: anything that already exists is skipped.
 * A second run should print nothing but `skip` and exit 0 — that is the
 * idempotency check, not an aspiration.
 *
 * Existence is probed before creating rather than inferred from a 409. On
 * Appwrite Cloud the plan-quota check runs *before* the already-exists check, so
 * re-creating an existing database on the free plan reports "maximum number of
 * databases reached" instead of a conflict. Probing also collapses a table's
 * column checks into one listColumns call. The 409 catch stays as a backstop.
 *
 * This script never drops or alters an existing column. If the deployed schema
 * has drifted from the file it warns and exits 1; fixing drift means editing the
 * schema, deleting the table in the console, and re-running.
 */

import {
  Client,
  TablesDB,
  Storage,
  TablesDBIndexType,
  OrderBy,
  Compression,
} from "node-appwrite";
import { TABLES, BUCKETS } from "./appwrite-schema.mjs";

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
  console.error("Add them to .env, then run npm run setup:appwrite again.");
  process.exit(1);
}

const DATABASE_ID = process.env.DATABASE_ID;

/**
 * A bucket's id comes from its env var, falling back to a fixed name where the
 * schema declares one. SNAPSHOT_STORAGE_ID is optional for exactly that reason:
 * an existing .env written before Week 3 still provisions correctly.
 */
const bucketId = (bucket) => process.env[bucket.envKey] || bucket.fallbackId;

const client = new Client()
  .setEndpoint(process.env.NEXT_PUBLIC_APPWRITE_ENDPOINT)
  .setProject(process.env.NEXT_PUBLIC_APPWRITE_PROJECT_ID)
  .setKey(process.env.APPWRITE_API_KEY);

const tablesDB = new TablesDB(client);
const storage = new Storage(client);

const stats = { created: 0, skipped: 0, failed: 0 };

const INDEX_TYPES = {
  key: TablesDBIndexType.Key,
  unique: TablesDBIndexType.Unique,
  fulltext: TablesDBIndexType.Fulltext,
};
const ORDERS = { asc: OrderBy.Asc, desc: OrderBy.Desc };
const COMPRESSION = {
  none: Compression.None,
  gzip: Compression.Gzip,
  zstd: Compression.Zstd,
};

const skip = (label) => {
  stats.skipped += 1;
  console.log(`  skip    ${label}`);
};

/** Run a create call, treating a concurrent already-exists (409) as success. */
async function create(label, fn) {
  try {
    await fn();
    stats.created += 1;
    console.log(`  create  ${label}`);
  } catch (error) {
    if (error?.code === 409) {
      skip(label);
      return;
    }
    stats.failed += 1;
    console.error(`  FAIL    ${label} — ${error?.message ?? error}`);
    throw error;
  }
}

/** Probe for a resource; create it only if the probe 404s. */
async function ensure(label, probe, fn) {
  try {
    await probe();
    skip(label);
    return;
  } catch (error) {
    if (error?.code !== 404) {
      stats.failed += 1;
      console.error(`  FAIL    ${label} — ${error?.message ?? error}`);
      throw error;
    }
  }
  await create(label, fn);
}

function createColumn(tableId, column) {
  const base = { databaseId: DATABASE_ID, tableId, key: column.key };

  switch (column.type) {
    case "varchar":
      return tablesDB.createVarcharColumn({
        ...base,
        size: column.size,
        required: column.required,
        xdefault: column.xdefault,
        array: column.array,
      });
    case "text":
      return tablesDB.createTextColumn({
        ...base,
        required: column.required,
        xdefault: column.xdefault,
      });
    case "float":
      return tablesDB.createFloatColumn({
        ...base,
        required: column.required,
        min: column.min,
        max: column.max,
        xdefault: column.xdefault,
      });
    case "integer":
      return tablesDB.createIntegerColumn({
        ...base,
        required: column.required,
        min: column.min,
        max: column.max,
        xdefault: column.xdefault,
      });
    case "datetime":
      return tablesDB.createDatetimeColumn({
        ...base,
        required: column.required,
        xdefault: column.xdefault,
      });
    case "enum":
      return tablesDB.createEnumColumn({
        ...base,
        elements: column.elements,
        required: column.required,
        xdefault: column.xdefault,
      });
    default:
      throw new Error(`Unknown column type "${column.type}" for ${column.key}`);
  }
}

/**
 * Appwrite creates columns asynchronously. A column sits in `processing` before
 * it becomes `available`, and creating an index over a not-yet-available column
 * fails. Poll until every column has settled.
 */
async function waitForColumns(tableId, { timeoutMs = 60_000, intervalMs = 750 } = {}) {
  const deadline = Date.now() + timeoutMs;

  while (Date.now() < deadline) {
    const { columns } = await tablesDB.listColumns({
      databaseId: DATABASE_ID,
      tableId,
    });

    const broken = columns.filter(
      (column) => column.status === "failed" || column.status === "stuck",
    );
    if (broken.length > 0) {
      const details = broken
        .map((column) => `${column.key} (${column.status}: ${column.error || "no detail"})`)
        .join(", ");
      throw new Error(`Columns did not build on ${tableId}: ${details}`);
    }

    if (columns.every((column) => column.status === "available")) return columns;

    await new Promise((resolve) => setTimeout(resolve, intervalMs));
  }

  throw new Error(
    `Columns on ${tableId} are still processing after ${timeoutMs / 1000}s. ` +
      "Re-run npm run setup:appwrite once they settle.",
  );
}

/** Report drift without trying to migrate it. */
function reportDrift(tableId, expected, actual) {
  const expectedKeys = new Set(expected.map((column) => column.key));
  const extra = actual
    .map((column) => column.key)
    .filter((key) => !expectedKeys.has(key));

  if (extra.length === 0) return false;

  console.warn(
    `  WARN    ${tableId} has columns not in the schema: ${extra.join(", ")}. ` +
      "Reconcile appwrite-schema.mjs with the console before continuing.",
  );
  return true;
}

async function setupTable(table) {
  console.log(`\ntable ${table.id}`);

  await ensure(
    `table ${table.id}`,
    () => tablesDB.getTable({ databaseId: DATABASE_ID, tableId: table.id }),
    () =>
      tablesDB.createTable({
        databaseId: DATABASE_ID,
        tableId: table.id,
        name: table.name,
        // Empty table-level permissions: every read and write goes through the
        // admin client inside /lib/repositories, so plan limits cannot be
        // bypassed by lifting the session secret out of devtools.
        permissions: [],
        rowSecurity: true,
      }),
  );

  const existingColumns = await tablesDB.listColumns({
    databaseId: DATABASE_ID,
    tableId: table.id,
  });
  const present = new Set(existingColumns.columns.map((column) => column.key));

  for (const column of table.columns) {
    const label = `column ${table.id}.${column.key}`;
    if (present.has(column.key)) {
      skip(label);
      continue;
    }
    await create(label, () => createColumn(table.id, column));
  }

  const columns = await waitForColumns(table.id);
  const drifted = reportDrift(table.id, table.columns, columns);

  const existingIndexes = await tablesDB.listIndexes({
    databaseId: DATABASE_ID,
    tableId: table.id,
  });
  const indexKeys = new Set(existingIndexes.indexes.map((index) => index.key));

  for (const index of table.indexes) {
    const label = `index  ${index.key}`;
    if (indexKeys.has(index.key)) {
      skip(label);
      continue;
    }
    await create(label, () =>
      tablesDB.createIndex({
        databaseId: DATABASE_ID,
        tableId: table.id,
        key: index.key,
        type: INDEX_TYPES[index.type],
        columns: index.columns,
        orders: index.orders?.map((order) => ORDERS[order]),
      }),
    );
  }

  return drifted;
}

/**
 * Widens an existing bucket to match the schema.
 *
 * The rule for columns is "never alter" — a type change can lose data, so drift
 * is reported and left alone. Buckets are different: the only changes made here
 * are additive (permit more file extensions, allow a larger file), nothing
 * already stored can be invalidated by them, and a bucket created before Week 3
 * rejects every snapshot upload until `json` is allowed.
 *
 * One case does tighten rather than widen: Appwrite treats an empty extension
 * list as "allow anything", so a bucket created without one ends up restricted
 * to the schema's list the first time this runs. That is the intent — the app
 * only ever uploads those types — but it is a real change, not a no-op.
 *
 * `fileSecurity` belongs in the widening set for a reason worth spelling out.
 * With it off, Appwrite ignores per-file permissions entirely and consults only
 * the bucket's own, which we deliberately leave empty. Every upload then carries
 * `read("any")` that does nothing, and an anonymous GET on a photo or a
 * published snapshot answers 401 — a broken image in the dashboard and a dead
 * embed on a customer's site. Turning it on grants exactly the access each file
 * already asks for and takes none away, so it is safe to reconcile; a bucket
 * created by hand in the console defaults to off, which is how this happens.
 */
async function reconcileBucket(bucket, id) {
  let current;

  try {
    current = await storage.getBucket({ bucketId: id });
  } catch {
    // Just created, so it already matches.
    return;
  }

  const missing = bucket.allowedFileExtensions.filter(
    (extension) => !current.allowedFileExtensions.includes(extension),
  );
  const needsSize = current.maximumFileSize < bucket.maximumFileSize;
  const needsFileSecurity = bucket.fileSecurity && !current.fileSecurity;

  if (missing.length === 0 && !needsSize && !needsFileSecurity) {
    skip(`bucket ${id} settings`);
    return;
  }

  const changes = [
    missing.length > 0 ? `+${missing.join(", +")}` : null,
    needsSize ? `max ${Math.round(bucket.maximumFileSize / 1024 / 1024)}MB` : null,
    needsFileSecurity ? "file security on" : null,
  ].filter(Boolean);

  await create(`bucket ${id} settings (${changes.join(", ")})`, () =>
    storage.updateBucket({
      bucketId: id,
      name: current.name,
      // Sent explicitly: updateBucket resets anything omitted, and the bucket's
      // own permissions staying empty is the point — access is per file.
      permissions: current.$permissions,
      fileSecurity: bucket.fileSecurity || current.fileSecurity,
      maximumFileSize: Math.max(current.maximumFileSize, bucket.maximumFileSize),
      allowedFileExtensions: [
        ...new Set([...current.allowedFileExtensions, ...bucket.allowedFileExtensions]),
      ],
      compression: current.compression,
      encryption: current.encryption,
      antivirus: current.antivirus,
    }),
  );
}

async function main() {
  console.log(
    `Provisioning Appwrite project ${process.env.NEXT_PUBLIC_APPWRITE_PROJECT_ID}`,
  );
  console.log(`  database ${DATABASE_ID}`);
  for (const bucket of BUCKETS) console.log(`  bucket   ${bucketId(bucket)}`);
  console.log("");

  await ensure(
    `database ${DATABASE_ID}`,
    () => tablesDB.get({ databaseId: DATABASE_ID }),
    () => tablesDB.create({ databaseId: DATABASE_ID, name: "app" }),
  );

  let drifted = false;
  for (const table of TABLES) {
    drifted = (await setupTable(table)) || drifted;
  }

  console.log("\nstorage");
  for (const bucket of BUCKETS) {
    const id = bucketId(bucket);

    await ensure(
      `bucket ${id}`,
      () => storage.getBucket({ bucketId: id }),
      () =>
        storage.createBucket({
          bucketId: id,
          name: bucket.name,
          // Empty bucket-level permissions, as with the tables: reads and writes
          // go through the admin client, and each file carries its own read rule.
          permissions: [],
          fileSecurity: bucket.fileSecurity,
          maximumFileSize: bucket.maximumFileSize,
          allowedFileExtensions: bucket.allowedFileExtensions,
          compression: COMPRESSION[bucket.compression],
          encryption: bucket.encryption,
          antivirus: bucket.antivirus,
        }),
    );

    await reconcileBucket(bucket, id);
  }

  console.log(
    `\n${stats.created} created, ${stats.skipped} skipped, ${stats.failed} failed`,
  );

  if (drifted) {
    console.error("\nSchema drift detected. Nothing was altered — see the warnings above.");
    process.exit(1);
  }
}

main().catch((error) => {
  console.error(
    `\n${stats.created} created, ${stats.skipped} skipped, ${stats.failed} failed`,
  );
  console.error(`\nSetup stopped: ${error?.message ?? error}`);
  process.exit(1);
});
