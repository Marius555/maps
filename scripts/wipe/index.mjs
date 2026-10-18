#!/usr/bin/env node
/**
 * Empty the project, keeping only the test accounts and everything they own.
 *
 *   npm run danger:wipe-database                # dry run: lists what would go, deletes nothing
 *   npm run danger:wipe-database -- --execute   # asks for the admin password, then deletes
 *
 * ## What goes
 *
 * Every Appwrite user not named in `WIPE_KEEP_EMAILS` (or as an `E2E_*`
 * account), and with them every row and stored file they own. Also every
 * analytics row, log, usage counter, news post and promotion; every discount
 * code at the payment provider; and every published snapshot on R2 that
 * belongs to a map that is not kept. Paying subscriptions of deleted accounts
 * are cancelled at the provider first, because a deleted row does not stop a
 * card being charged.
 *
 * ## What stops it
 *
 * The code is public; the credentials are not. Everything it does, the
 * `APPWRITE_API_KEY` in .env could already do from Appwrite's console, so it
 * adds no way in. What it adds is a lock against running it by accident:
 * `--execute` needs a terminal (never CI, a pipe or an agent), the operator
 * console's password (checked against `ADMIN_PASSWORD_HASH`), every kept email
 * to exist, and the project id typed back — then waits ten seconds.
 *
 * It deletes in an order that is safe to re-run after a failure: provider
 * first, then files, rows and snapshots, and the accounts last.
 */

import { r2Bucket } from "../r2.mjs";
import { connect, deleteRowsById } from "./appwrite.mjs";
import { countdown, fail, requireAdminPassword, requireConfirmation, requireTerminal } from "./guards.mjs";
import { resolveKeepSet } from "./keep-set.mjs";
import { cancelSubscription, deleteDiscount } from "./lemon.mjs";
import { checkSchemaCoverage, planWipe } from "./plan.mjs";

/*
 * `npm run danger:wipe-database --execute` (no bare `--`) never reaches argv:
 * npm takes the flag as its own config and exposes it as `npm_config_execute`.
 * Both spellings mean the same thing; the guards below are what stop a run.
 */
const execute =
  process.argv.includes("--execute") || process.env.npm_config_execute === "true";

checkSchemaCoverage();

if (execute) {
  requireTerminal();
  await requireAdminPassword();
}

const appwrite = connect();

console.log(`Project ${appwrite.projectId}. Reading everything…\n`);

const keep = await resolveKeepSet(appwrite);
const plan = await planWipe(appwrite, keep);

printPlan(keep, plan);

if (!execute) {
  console.log("\nDry run: nothing was deleted. Add -- --execute to delete the above.");
  process.exit(0);
}

if (plan.subscriptions.blocked) {
  fail("Refusing: there are subscriptions to cancel and no LEMON_API_KEY to cancel them with.");
}

await requireConfirmation(appwrite.projectId);
await countdown(10);

let failed = 0;

await step("Cancelling subscriptions", plan.subscriptions.toCancel, (sub) =>
  cancelSubscription(sub.subscriptionId),
);

/*
 * A subscription that could not be cancelled is still charging somebody. Its
 * row is the only record of it on our side, so nothing else runs.
 */
if (failed > 0) {
  fail("Stopped before deleting anything else: a subscription could not be cancelled. Re-run once it is.");
}

await step("Deleting discount codes", plan.discounts, (discount) => deleteDiscount(discount.id));

for (const [bucketId, { remove }] of Object.entries(plan.files)) {
  await step(`Deleting files in ${bucketId}`, remove, (fileId) =>
    appwrite.storage.deleteFile({ bucketId, fileId }),
  );
}

for (const [tableId, { remove }] of Object.entries(plan.rows)) {
  if (remove.length === 0) continue;

  process.stdout.write(`Deleting ${remove.length} rows from ${tableId}… `);
  try {
    await deleteRowsById(appwrite, tableId, remove);
    console.log("done");
  } catch (error) {
    failed += 1;
    console.log(`failed — ${error.message}`);
  }
}

if (plan.r2.remove.length > 0) {
  const bucket = r2Bucket();
  await step("Deleting snapshots on R2", plan.r2.remove, (key) => bucket.remove(key));
}

await step("Deleting accounts", plan.users, (user) => appwrite.users.delete({ userId: user.id }));

console.log(
  failed > 0
    ? `\nFinished with ${failed} failure(s). Run it again: it picks up whatever is left.`
    : "\nWiped. Only the test accounts and their data remain.",
);
process.exit(failed > 0 ? 1 : 0);

async function step(label, items, run) {
  if (items.length === 0) return;

  process.stdout.write(`${label} (${items.length})… `);
  let stepFailed = 0;

  for (const item of items) {
    try {
      await run(item);
    } catch (error) {
      stepFailed += 1;
      console.error(`\n  failed  ${typeof item === "string" ? item : (item.id ?? item.subscriptionId)} — ${error.message}`);
    }
  }

  failed += stepFailed;
  console.log(stepFailed > 0 ? `${stepFailed} failed` : "done");
}

function printPlan(keep, plan) {
  console.log("KEEP — test accounts:");
  for (const user of keep.keptUsers) console.log(`  ${user.email}`);
  console.log(`  with ${keep.mapIds.size} map(s) and ${keep.fileIds.size} photo/logo file(s)\n`);

  console.log(`DELETE — ${plan.users.length} account(s):`);
  for (const user of plan.users.slice(0, 25)) console.log(`  ${user.email || user.id}`);
  if (plan.users.length > 25) console.log(`  …and ${plan.users.length - 25} more`);

  console.log("\nRows:");
  for (const [tableId, { kept, remove }] of Object.entries(plan.rows)) {
    console.log(`  ${tableId.padEnd(14)} delete ${String(remove.length).padStart(6)}   keep ${kept}`);
  }

  console.log("\nStored files:");
  for (const [bucketId, { kept, remove }] of Object.entries(plan.files)) {
    console.log(`  ${bucketId.padEnd(14)} delete ${String(remove.length).padStart(6)}   keep ${kept}`);
  }

  console.log("\nPublished snapshots on R2:");
  console.log(`  delete ${plan.r2.remove.length} object(s); keep those of ${plan.r2.keptMaps} test map(s)`);
  if (plan.r2.untouched.length > 0) {
    console.log(`  never touched: ${plan.r2.untouched.map((folder) => `${folder}/`).join(", ")}`);
  }

  console.log("\nPayment provider:");
  console.log(`  cancel ${plan.subscriptions.toCancel.length} live subscription(s)`);
  for (const sub of plan.subscriptions.toCancel) {
    console.log(`    ${sub.email} — ${sub.status}`);
  }
  console.log(`  delete ${plan.discounts.length} discount code(s)`);
  for (const discount of plan.discounts) console.log(`    ${discount.code}`);

  for (const warning of plan.warnings) console.log(`\n! ${warning}`);
}
