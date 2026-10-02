/**
 * Take every user write permission off every row and file, and check that no
 * subscription row was edited by its owner while it could be.
 *
 *   npm run migrate:permissions -- --dry-run
 *   npm run migrate:permissions
 *   npm run migrate:permissions -- --verify-subscriptions
 *   npm run migrate:permissions -- --verify-subscriptions --fix
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
 * ## `--verify-subscriptions`
 *
 * Asks the provider about every subscription row and prints any row that
 * disagrees with what the provider says — the fingerprint of a row somebody
 * edited while they could. A row that claims a paid plan with no provider id
 * behind it is reported too, as is a kept plan that outlasts the period it was
 * kept for. `--fix` overwrites each with the provider's answer (and clears a
 * kept plan that could not have been granted). Needs `LEMON_API_KEY` (or
 * `LEMON_TEST_API_KEY`) and the four `LEMON_VARIANT_*` ids.
 *
 * The mapping below mirrors `toStatus` and `toState` in lib/billing/lemon.ts —
 * duplicated rather than imported because this is a plain .mjs script, the trade
 * `migrate-categories-to-tags.mjs` makes too. It is only ever used to *compare*;
 * a drift shows up as a reported mismatch, never as a silent write.
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

/** Every table a row was ever created in with `ownerPermissions`. */
const OWNED_TABLES = [
  "maps",
  "places",
  "shapes",
  "groups",
  "sheetLinks",
  "cardDesigns",
  "subscriptions",
];

const BUCKETS = [
  ...new Set([process.env.STORAGE_ID, process.env.SNAPSHOT_STORAGE_ID].filter(Boolean)),
];

const dryRun = process.argv.includes("--dry-run");
const verify = process.argv.includes("--verify-subscriptions");
const fix = process.argv.includes("--fix");

const client = new Client()
  .setEndpoint(process.env.NEXT_PUBLIC_APPWRITE_ENDPOINT)
  .setProject(process.env.NEXT_PUBLIC_APPWRITE_PROJECT_ID)
  .setKey(process.env.APPWRITE_API_KEY);

const tablesDB = new TablesDB(client);
const storage = new Storage(client);

let failed = 0;

if (verify) {
  await verifySubscriptions();
} else {
  await stripRows();
  await stripFiles();
}

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

/* ---------- subscriptions ---------- */

const LEMON_API = "https://api.lemonsqueezy.com/v1";
const lemonKey = process.env.LEMON_API_KEY || process.env.LEMON_TEST_API_KEY || "";

const VARIANTS = {
  [process.env.LEMON_VARIANT_STARTER_MONTHLY ?? ""]: { plan: "starter", cadence: "monthly" },
  [process.env.LEMON_VARIANT_STARTER_YEARLY ?? ""]: { plan: "starter", cadence: "yearly" },
  [process.env.LEMON_VARIANT_PRO_MONTHLY ?? ""]: { plan: "pro", cadence: "monthly" },
  [process.env.LEMON_VARIANT_PRO_YEARLY ?? ""]: { plan: "pro", cadence: "yearly" },
};
delete VARIANTS[""];

/** Mirrors `toStatus` in lib/billing/lemon.ts. */
const STATUS = {
  on_trial: "trialing",
  active: "active",
  paused: "paused",
  past_due: "past_due",
  unpaid: "canceled",
  cancelled: "active",
  expired: "canceled",
};

async function providerState(subscriptionId) {
  const response = await fetch(`${LEMON_API}/subscriptions/${subscriptionId}`, {
    headers: {
      accept: "application/vnd.api+json",
      authorization: `Bearer ${lemonKey}`,
    },
    signal: AbortSignal.timeout(15_000),
  });

  if (response.status === 404) return null;
  if (!response.ok) throw new Error(`provider answered ${response.status}`);

  const json = await response.json();
  const attributes = json.data?.attributes ?? {};
  const offer = VARIANTS[String(attributes.variant_id ?? "")];

  return {
    plan: offer?.plan ?? null,
    cadence: offer?.cadence ?? null,
    status: STATUS[attributes.status] ?? "canceled",
    billingCustomerId:
      attributes.customer_id === undefined ? "" : String(attributes.customer_id),
    currentPeriodEnd: attributes.ends_at ?? attributes.renews_at ?? null,
  };
}

function sameInstant(a, b) {
  if (!a && !b) return true;
  if (!a || !b) return false;

  return new Date(a).getTime() === new Date(b).getTime();
}

async function verifySubscriptions() {
  if (!lemonKey) {
    console.error("LEMON_API_KEY is not set, so the provider cannot be asked.");
    process.exit(1);
  }

  if (Object.keys(VARIANTS).length < 4) {
    console.error("Set all four LEMON_VARIANT_* ids, or every paid row reads as a mismatch.");
    process.exit(1);
  }

  console.log(
    fix
      ? "Comparing every subscription to the provider, and fixing what disagrees.\n"
      : "Comparing every subscription to the provider. Nothing will be written.\n",
  );

  let checked = 0;
  let mismatched = 0;

  for await (const row of allRows("subscriptions")) {
    checked += 1;

    const problems = [];
    let truth = null;

    if (!row.billingSubscriptionId) {
      if (row.status === "active" || row.status === "trialing") {
        problems.push(`claims ${row.plan}/${row.status} with no provider subscription`);
        truth = { status: "canceled" };
      }
    } else if (!/^\d{1,20}$/.test(row.billingSubscriptionId)) {
      problems.push(`billingSubscriptionId "${row.billingSubscriptionId}" is not a provider id`);
      truth = { status: "canceled", billingSubscriptionId: "" };
    } else {
      let state;

      try {
        state = await providerState(row.billingSubscriptionId);
      } catch (error) {
        failed += 1;
        console.error(`  failed  ${row.userId} — ${error.message}`);
        continue;
      }

      if (!state) {
        problems.push(`provider has no subscription ${row.billingSubscriptionId}`);
        truth = { status: "canceled" };
      } else {
        if (state.plan && row.plan !== state.plan) problems.push(`plan ${row.plan} ≠ ${state.plan}`);
        if (row.status !== state.status) problems.push(`status ${row.status} ≠ ${state.status}`);
        if (!sameInstant(row.currentPeriodEnd, state.currentPeriodEnd)) {
          problems.push(`period end ${row.currentPeriodEnd} ≠ ${state.currentPeriodEnd}`);
        }
        if (state.billingCustomerId && row.billingCustomerId !== state.billingCustomerId) {
          problems.push(`customer ${row.billingCustomerId} ≠ ${state.billingCustomerId}`);
        }

        truth = {
          ...(state.plan ? { plan: state.plan, cadence: state.cadence } : {}),
          status: state.status,
          currentPeriodEnd: state.currentPeriodEnd,
          billingCustomerId: state.billingCustomerId,
        };
      }
    }

    /*
     * A kept plan only ever runs to the end of the period it was paid in — the
     * change-plan route writes `keptUntil` from that date. One that outlasts the
     * period could not have come from us.
     */
    const periodEnd = truth?.currentPeriodEnd ?? row.currentPeriodEnd;
    if (row.keptUntil && (!periodEnd || new Date(row.keptUntil) > new Date(periodEnd))) {
      problems.push(`kept ${row.keptPlan} until ${row.keptUntil}, past the period end`);
      truth = { ...(truth ?? {}), keptPlan: null, keptCadence: null, keptUntil: null };
    }

    if (problems.length === 0) continue;

    mismatched += 1;
    console.log(`  ${fix ? "fixed  " : "differs"} ${row.userId} — ${problems.join("; ")}`);

    if (fix && truth) {
      try {
        await tablesDB.updateRow({
          databaseId: DATABASE_ID,
          tableId: "subscriptions",
          rowId: row.$id,
          data: truth,
          permissions: [],
        });
      } catch (error) {
        failed += 1;
        console.error(`  failed  ${row.userId} — ${error.message}`);
      }
    }
  }

  console.log(`\n${checked} subscriptions checked, ${mismatched} disagreed with the provider.`);
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
