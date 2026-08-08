import "server-only";

import { APPWRITE_ENDPOINT, APPWRITE_PROJECT_ID } from "@/lib/appwrite/config";
import { env } from "@/lib/env";

/**
 * The public URL for an uploaded photo.
 *
 * Built on the server and handed to the client as part of the place, so the
 * bucket id stays out of the browser bundle and out of the embed's config.
 *
 * The URL needs no session because place photos are uploaded with public read
 * permission — they are destined for a stranger's website in Week 3, and any
 * authenticated variant would put a metered request in the visitor's path
 * (CLAUDE.md §2).
 */
export function photoViewUrl(fileId: string | null | undefined): string | null {
  if (!fileId) return null;

  return (
    `${APPWRITE_ENDPOINT}/storage/buckets/${env.storageId}` +
    `/files/${fileId}/view?project=${APPWRITE_PROJECT_ID}`
  );
}
