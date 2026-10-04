import "server-only";

import { ID, Query, type Models } from "node-appwrite";

import { admin } from "@/lib/appwrite/admin";
import { TABLES } from "@/lib/appwrite/config";
import { isConflict, toRepositoryError } from "@/lib/appwrite/errors";
import { env } from "@/lib/env";
import type { NewsCategory, NewsPost } from "@/lib/news/types";
import type { NewsInput } from "@/lib/validation/news.schema";
import { ConflictError } from "./errors";
import { assertUploadable, PUBLIC_FILE_PERMISSIONS, removeFiles } from "./files.repository";
import { toNewsPost } from "./mappers";
import type { NewsRow } from "./types";

/**
 * Posts on the public /news page. docs/notes/news.md.
 *
 * Not under `repositories/admin/`, because the public pages read it (the
 * precedent is `promotions.repository.ts`); only the operator console's routes
 * write it. Admin client only, and no row carries a permission — whether a post
 * is on the site is decided by the query, never by Appwrite's ACL.
 *
 * The public reads are never called per page view: `lib/news/public.ts` caches
 * them, and every write route revalidates that cache.
 */

/** Most posts a list returns. Past this the page needs paging, which is a later problem. */
const LIST_LIMIT = 100;

/** The slug is taken by another post. Its own class so the route can name the field. */
export class NewsSlugTakenError extends ConflictError {
  constructor() {
    super("That address is already used by another post. Change it and save again.");
  }
}

// ---------------------------------------------------------------------------
// Public reads
// ---------------------------------------------------------------------------

/** Every post on the site now, newest first — optionally one category's. */
export async function listPublishedNews(category?: NewsCategory): Promise<NewsPost[]> {
  try {
    const result = await admin.tablesDB.listRows<NewsRow>({
      databaseId: env.databaseId,
      tableId: TABLES.news,
      queries: [
        Query.isNotNull("publishedAt"),
        Query.lessThanEqual("publishedAt", new Date().toISOString()),
        ...(category ? [Query.equal("category", category)] : []),
        Query.orderDesc("publishedAt"),
        Query.limit(LIST_LIMIT),
      ],
    });

    return result.rows.map(toNewsPost);
  } catch (error) {
    throw toRepositoryError(error);
  }
}

/** One post by its address, if it is on the site now. Drafts and scheduled posts are null. */
export async function getPublishedNewsBySlug(slug: string): Promise<NewsPost | null> {
  try {
    const result = await admin.tablesDB.listRows<NewsRow>({
      databaseId: env.databaseId,
      tableId: TABLES.news,
      queries: [
        Query.equal("slug", slug),
        Query.isNotNull("publishedAt"),
        Query.lessThanEqual("publishedAt", new Date().toISOString()),
        Query.limit(1),
      ],
    });
    const row = result.rows[0];

    return row ? toNewsPost(row) : null;
  } catch (error) {
    throw toRepositoryError(error);
  }
}

// ---------------------------------------------------------------------------
// Operator console
// ---------------------------------------------------------------------------

/** Every post, drafts and scheduled ones included — newest edit first. */
export async function listAllNews(): Promise<NewsPost[]> {
  try {
    const result = await admin.tablesDB.listRows<NewsRow>({
      databaseId: env.databaseId,
      tableId: TABLES.news,
      queries: [Query.orderDesc("$updatedAt"), Query.limit(LIST_LIMIT)],
    });

    return result.rows.map(toNewsPost);
  } catch (error) {
    throw toRepositoryError(error);
  }
}

export async function getNews(id: string): Promise<NewsPost> {
  return toNewsPost(await getRow(id));
}

export async function createNews(input: NewsInput): Promise<NewsPost> {
  await assertSlugFree(input.slug);

  try {
    const row = await admin.tablesDB.createRow<NewsRow>({
      databaseId: env.databaseId,
      tableId: TABLES.news,
      rowId: ID.unique(),
      data: toData(input),
      permissions: [],
    });

    return toNewsPost(row);
  } catch (error) {
    throw slugError(error);
  }
}

export async function updateNews(id: string, input: NewsInput): Promise<NewsPost> {
  await assertSlugFree(input.slug, id);

  try {
    return toNewsPost(await writeRow(id, toData(input)));
  } catch (error) {
    throw slugError(error);
  }
}

/** Publish now (`publishedAt` = this moment) or take off the site (null). */
export async function setNewsPublishedAt(id: string, publishedAt: string | null): Promise<NewsPost> {
  try {
    return toNewsPost(await writeRow(id, { publishedAt }));
  } catch (error) {
    throw toRepositoryError(error);
  }
}

/** Delete a post and its cover file. The file goes second, and best effort. */
export async function deleteNews(id: string): Promise<void> {
  const row = await getRow(id);

  try {
    await admin.tablesDB.deleteRow({
      databaseId: env.databaseId,
      tableId: TABLES.news,
      rowId: id,
    });
  } catch (error) {
    throw toRepositoryError(error);
  }

  if (row.coverFileId) await removeFiles([row.coverFileId]);
}

/**
 * Replace a post's cover image — `setPlaceLogo`'s order: upload, point the row
 * at it (deleting the upload if that fails), and only then delete the old file.
 * Public read, because the image is drawn on a public page straight from storage.
 */
export async function setNewsCover(id: string, file: File): Promise<NewsPost> {
  const row = await getRow(id);

  assertUploadable(file, "cover");

  let uploaded: string;

  try {
    const created = await admin.storage.createFile({
      bucketId: env.storageId,
      fileId: ID.unique(),
      file,
      permissions: PUBLIC_FILE_PERMISSIONS,
    });

    uploaded = created.$id;
  } catch (error) {
    throw toRepositoryError(error);
  }

  let updated: NewsRow;

  try {
    updated = await writeRow(id, { coverFileId: uploaded });
  } catch (error) {
    await removeFiles([uploaded]);
    throw toRepositoryError(error);
  }

  if (row.coverFileId) await removeFiles([row.coverFileId]);

  return toNewsPost(updated);
}

/** Drop the cover. A post with none is a no-op, not an error. */
export async function clearNewsCover(id: string): Promise<NewsPost> {
  const row = await getRow(id);

  if (!row.coverFileId) return toNewsPost(row);

  try {
    const updated = await writeRow(id, { coverFileId: null });

    await removeFiles([row.coverFileId]);

    return toNewsPost(updated);
  } catch (error) {
    throw toRepositoryError(error);
  }
}

// ---------------------------------------------------------------------------

function toData(input: NewsInput) {
  return {
    title: input.title,
    slug: input.slug,
    summary: input.summary,
    body: input.body,
    category: input.category,
    coverAlt: input.coverAlt || null,
    publishedAt: input.publishedAt,
  };
}

async function getRow(id: string): Promise<NewsRow> {
  try {
    return await admin.tablesDB.getRow<NewsRow>({
      databaseId: env.databaseId,
      tableId: TABLES.news,
      rowId: id,
    });
  } catch (error) {
    throw toRepositoryError(error);
  }
}

async function writeRow(id: string, data: Partial<Omit<NewsRow, keyof Models.Row>>) {
  return admin.tablesDB.updateRow<NewsRow>({
    databaseId: env.databaseId,
    tableId: TABLES.news,
    rowId: id,
    data,
  });
}

/**
 * Refuse a slug another post holds, before writing — so the message can name
 * the field. The unique index is the backstop for two saves racing.
 */
async function assertSlugFree(slug: string, exceptId?: string): Promise<void> {
  try {
    const result = await admin.tablesDB.listRows<NewsRow>({
      databaseId: env.databaseId,
      tableId: TABLES.news,
      queries: [Query.equal("slug", slug), Query.select(["$id"]), Query.limit(2)],
    });

    if (result.rows.some((row) => row.$id !== exceptId)) throw new NewsSlugTakenError();
  } catch (error) {
    throw toRepositoryError(error);
  }
}

function slugError(error: unknown): unknown {
  return isConflict(error) ? new NewsSlugTakenError() : toRepositoryError(error);
}
