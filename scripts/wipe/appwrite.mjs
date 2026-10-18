/**
 * The Appwrite half of the wipe: one admin client, pagers for rows, files and
 * users, and the batched row delete. Plain .mjs, so it cannot import lib/ — the
 * pagers are migrate-permissions.mjs's, copied.
 */

import { Client, Query, Storage, TablesDB, Users } from "node-appwrite";

const REQUIRED_ENV = [
  "NEXT_PUBLIC_APPWRITE_ENDPOINT",
  "NEXT_PUBLIC_APPWRITE_PROJECT_ID",
  "APPWRITE_API_KEY",
  "DATABASE_ID",
  "STORAGE_ID",
];

export const PAGE_SIZE = 100;

export function connect() {
  const missing = REQUIRED_ENV.filter((key) => !process.env[key]);
  if (missing.length > 0) {
    console.error(`Missing environment variables: ${missing.join(", ")}`);
    console.error("Add them to .env, then run npm run danger:wipe-database again.");
    process.exit(1);
  }

  const client = new Client()
    .setEndpoint(process.env.NEXT_PUBLIC_APPWRITE_ENDPOINT)
    .setProject(process.env.NEXT_PUBLIC_APPWRITE_PROJECT_ID)
    .setKey(process.env.APPWRITE_API_KEY);

  return {
    projectId: process.env.NEXT_PUBLIC_APPWRITE_PROJECT_ID,
    databaseId: process.env.DATABASE_ID,
    bucketIds: [
      ...new Set([process.env.STORAGE_ID, process.env.SNAPSHOT_STORAGE_ID].filter(Boolean)),
    ],
    tablesDB: new TablesDB(client),
    storage: new Storage(client),
    users: new Users(client),
  };
}

export async function* allRows(appwrite, tableId, queries = []) {
  let cursor = null;

  for (;;) {
    const page = [...queries, Query.limit(PAGE_SIZE), Query.orderAsc("$id")];
    if (cursor) page.push(Query.cursorAfter(cursor));

    const { rows } = await appwrite.tablesDB.listRows({
      databaseId: appwrite.databaseId,
      tableId,
      queries: page,
    });

    if (rows.length === 0) return;

    yield* rows;

    if (rows.length < PAGE_SIZE) return;
    cursor = rows[rows.length - 1].$id;
  }
}

export async function* allFiles(appwrite, bucketId) {
  let cursor = null;

  for (;;) {
    const queries = [Query.limit(PAGE_SIZE), Query.orderAsc("$id")];
    if (cursor) queries.push(Query.cursorAfter(cursor));

    const { files } = await appwrite.storage.listFiles({ bucketId, queries });

    if (files.length === 0) return;

    yield* files;

    if (files.length < PAGE_SIZE) return;
    cursor = files[files.length - 1].$id;
  }
}

/** Same ordering as lib/repositories/admin/users.ts. */
export async function* allUsers(appwrite) {
  let cursor = null;

  for (;;) {
    const queries = [Query.orderDesc("$createdAt"), Query.limit(PAGE_SIZE)];
    if (cursor) queries.push(Query.cursorAfter(cursor));

    const { users } = await appwrite.users.list({ queries });

    if (users.length === 0) return;

    yield* users;

    if (users.length < PAGE_SIZE) return;
    cursor = users[users.length - 1].$id;
  }
}

export function chunks(list, size = PAGE_SIZE) {
  const out = [];
  for (let i = 0; i < list.length; i += size) out.push(list.slice(i, i + size));
  return out;
}

/**
 * Deletes exactly these rows, a hundred at a time. By `$id` and never by a
 * column query, so what runs is what the dry run listed and nothing else.
 */
export async function deleteRowsById(appwrite, tableId, rowIds) {
  for (const ids of chunks(rowIds)) {
    await appwrite.tablesDB.deleteRows({
      databaseId: appwrite.databaseId,
      tableId,
      queries: [Query.equal("$id", ids)],
    });
  }
}
