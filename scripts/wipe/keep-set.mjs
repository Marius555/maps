/**
 * Who and what survives a wipe: the test accounts named in .env, every map
 * they own, and every stored file those maps' locations point at.
 *
 * The emails come from `WIPE_KEEP_EMAILS` (comma-separated) plus the e2e
 * accounts, which the test suite needs to exist. An address with no account
 * behind it stops the run — a typo must never be how a test account is lost.
 */

import { Query } from "node-appwrite";

import { allRows, allUsers, chunks } from "./appwrite.mjs";
import { fail } from "./guards.mjs";

const E2E_EMAIL_VARS = ["E2E_EMAIL", "E2E_EMAIL_2", "E2E_UNVERIFIED_EMAIL"];

export function keepEmails() {
  const listed = (process.env.WIPE_KEEP_EMAILS ?? "").split(",");
  const e2e = E2E_EMAIL_VARS.map((name) => process.env[name] ?? "");

  return [...new Set([...listed, ...e2e].map((email) => email.trim().toLowerCase()).filter(Boolean))];
}

export async function resolveKeepSet(appwrite) {
  const emails = keepEmails();

  if (emails.length === 0) {
    fail(
      "No test accounts to keep. Add WIPE_KEEP_EMAILS=you@example.com,other@example.com to .env\n" +
        "(the E2E_EMAIL accounts are kept too, when set).",
    );
  }

  const users = [];
  for await (const user of allUsers(appwrite)) users.push(user);

  const byEmail = new Map(users.map((user) => [user.email.toLowerCase(), user]));
  const unknown = emails.filter((email) => !byEmail.has(email));

  if (unknown.length > 0) {
    fail(
      `No account exists for: ${unknown.join(", ")}\n` +
        "Fix the address in .env (WIPE_KEEP_EMAILS / E2E_EMAIL…) or remove it. Nothing was deleted.",
    );
  }

  const keptUsers = emails.map((email) => byEmail.get(email));
  const userIds = new Set(keptUsers.map((user) => user.$id));

  const mapIds = new Set();
  for (const ids of chunks([...userIds])) {
    for await (const map of allRows(appwrite, "maps", [Query.equal("userId", ids)])) {
      mapIds.add(map.$id);
    }
  }

  const fileIds = new Set();
  for (const ids of chunks([...mapIds])) {
    for await (const place of allRows(appwrite, "places", [Query.equal("mapId", ids)])) {
      for (const id of place.photoIds ?? []) fileIds.add(id);
      if (place.photoId) fileIds.add(place.photoId);
      if (place.logoId) fileIds.add(place.logoId);
    }
  }

  return { users, keptUsers, userIds, mapIds, fileIds };
}
