/**
 * Everything the wipe will delete, worked out before anything is deleted — so
 * the dry run and the real run read the same list, and the real run deletes
 * exactly what was printed.
 */

import { TABLES } from "../appwrite-schema.mjs";
import { r2Bucket } from "../r2.mjs";
import { allFiles, allRows } from "./appwrite.mjs";
import { fail } from "./guards.mjs";
import { lemonKey, listDiscounts, subscriptionStatus } from "./lemon.mjs";

/**
 * How each table decides whether a row belongs to a kept account. Every table
 * in scripts/appwrite-schema.mjs must be here: a table added later stops the
 * wipe until somebody decides what it means, rather than being silently
 * emptied or silently left full.
 */
const ROW_POLICY = {
  maps: "userId",
  cardDesigns: "userId",
  subscriptions: "userId",
  usage: "userId", // the pooled daily rows (userId "*") belong to nobody, so they go
  places: "mapId",
  shapes: "mapId",
  groups: "mapId",
  sheetLinks: "mapId",
  mapSessions: "mapId",
  mapDaily: "mapId",
  notifications: "audienceUserId", // broadcasts go; a kept account's own stay
  apiCalls: "all",
  emailLog: "all",
  promotions: "all",
  news: "all",
  // A membership survives only when both ends do: a kept owner's team loses
  // the people who are being deleted, and a kept member loses deleted teams.
  memberships: "membership",
  // An invite out from a kept workspace stays; one from a deleted one goes.
  invites: "workspaceId",
};

/** A snapshot's folder on R2 is a map id: ID.unique(), 20 lowercase hex characters. */
const MAP_ID = /^[0-9a-f]{20}$/;

/** The CDN's own files share the snapshot bucket (scripts/r2.mjs) and are never touched. */
const PROTECTED_R2_PREFIXES = new Set(["embed", "gazetteer"]);

/** Provider statuses that can still charge a card. */
const BILLABLE = new Set(["on_trial", "active", "paused", "past_due", "unpaid"]);

export function checkSchemaCoverage() {
  const schema = TABLES.map((table) => table.id);
  const unknown = schema.filter((id) => !(id in ROW_POLICY));
  const stale = Object.keys(ROW_POLICY).filter((id) => !schema.includes(id));

  if (unknown.length > 0 || stale.length > 0) {
    fail(
      "The wipe's table list is out of date with scripts/appwrite-schema.mjs.\n" +
        (unknown.length ? `  Not handled: ${unknown.join(", ")}\n` : "") +
        (stale.length ? `  No longer in the schema: ${stale.join(", ")}\n` : "") +
        "Update ROW_POLICY in scripts/wipe/plan.mjs first.",
    );
  }
}

export async function planWipe(appwrite, keep) {
  const warnings = [];

  const users = keep.users
    .filter((user) => !keep.userIds.has(user.$id))
    .map((user) => ({ id: user.$id, email: user.email }));

  const rows = {};
  const doomedSubscriptions = [];

  for (const [tableId, policy] of Object.entries(ROW_POLICY)) {
    const remove = [];
    let kept = 0;

    for await (const row of allRows(appwrite, tableId)) {
      if (keeps(policy, row, keep)) {
        kept += 1;
        continue;
      }

      remove.push(row.$id);
      if (tableId === "subscriptions" && row.billingSubscriptionId) doomedSubscriptions.push(row);
    }

    rows[tableId] = { kept, remove };
  }

  const subscriptions = await planSubscriptions(doomedSubscriptions, keep, warnings);
  const discounts = await planDiscounts(warnings);
  const files = await planFiles(appwrite, keep);
  const r2 = await planR2(keep, warnings);

  return { users, rows, subscriptions, discounts, files, r2, warnings };
}

function keeps(policy, row, keep) {
  switch (policy) {
    case "userId":
      return keep.userIds.has(row.userId);
    case "mapId":
      return keep.mapIds.has(row.mapId);
    case "audienceUserId":
      return row.audience === "user" && keep.userIds.has(row.audienceUserId);
    case "membership":
      return keep.userIds.has(row.workspaceId) && keep.userIds.has(row.userId);
    case "workspaceId":
      return keep.userIds.has(row.workspaceId);
    default:
      return false;
  }
}

async function planSubscriptions(rows, keep, warnings) {
  const emailOf = new Map(keep.users.map((user) => [user.$id, user.email]));
  const toCancel = [];

  if (rows.length === 0) return { toCancel, blocked: false };

  if (!lemonKey()) {
    warnings.push(
      `${rows.length} deleted account(s) have a payment-provider subscription, and no LEMON_API_KEY ` +
        "is set to cancel them. --execute will refuse until it is.",
    );
    return { toCancel, blocked: true };
  }

  for (const row of rows) {
    const status = await subscriptionStatus(row.billingSubscriptionId);
    if (!BILLABLE.has(status)) continue;

    toCancel.push({
      subscriptionId: row.billingSubscriptionId,
      email: emailOf.get(row.userId) ?? row.userId,
      status,
    });
  }

  return { toCancel, blocked: false };
}

async function planDiscounts(warnings) {
  const storeId = process.env.LEMON_STORE_ID ?? "";

  if (!lemonKey() || !storeId) {
    warnings.push("LEMON_API_KEY or LEMON_STORE_ID is not set, so discount codes are left alone.");
    return [];
  }

  return listDiscounts(storeId);
}

async function planFiles(appwrite, keep) {
  const files = {};

  for (const bucketId of appwrite.bucketIds) {
    const remove = [];
    let kept = 0;

    for await (const file of allFiles(appwrite, bucketId)) {
      if (keepsFile(file, keep)) kept += 1;
      else remove.push(file.$id);
    }

    files[bucketId] = { kept, remove };
  }

  return files;
}

/**
 * A kept location's photo or logo, or a kept map's snapshot from before R2:
 * `live-{mapId}`, archives named `{mapId}-{stamp}.json` (lib/snapshot/appwrite-store.ts).
 */
function keepsFile(file, keep) {
  if (keep.fileIds.has(file.$id)) return true;
  if (file.$id.startsWith("live-") && keep.mapIds.has(file.$id.slice(5))) return true;

  const dash = file.name.indexOf("-");
  return dash > 0 && keep.mapIds.has(file.name.slice(0, dash));
}

async function planR2(keep, warnings) {
  const configured = ["CLOUDFLARE_ACCOUNT_ID", "R2_ACCESS_KEY_ID", "R2_SECRET_ACCESS_KEY"].every(
    (name) => process.env[name],
  );

  if (!configured) {
    warnings.push("R2 is not configured in .env, so published snapshots on the CDN are left alone.");
    return { remove: [], keptMaps: 0, untouched: [] };
  }

  const keys = await r2Bucket().list("");
  const remove = [];
  const keptMaps = new Set();
  const untouched = new Set();

  for (const key of keys) {
    const folder = key.split("/")[0];

    if (PROTECTED_R2_PREFIXES.has(folder) || !MAP_ID.test(folder)) {
      untouched.add(folder);
    } else if (keep.mapIds.has(folder)) {
      keptMaps.add(folder);
    } else {
      remove.push(key);
    }
  }

  return { remove, keptMaps: keptMaps.size, untouched: [...untouched].sort() };
}
