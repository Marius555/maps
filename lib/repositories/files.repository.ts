import "server-only";

import { ID, Permission, Role } from "node-appwrite";

import { admin } from "@/lib/appwrite/admin";
import { TABLES } from "@/lib/appwrite/config";
import { toRepositoryError } from "@/lib/appwrite/errors";
import { env } from "@/lib/env";
import { ALLOWED_PHOTO_TYPES, MAX_PHOTO_BYTES } from "@/lib/validation/photo";
import type { RepoContext } from "./context";
import { RepositoryError } from "./errors";
import { toPlace } from "./mappers";
import { getPlace } from "./places.repository";
import type { Place, PlaceRow } from "./types";

/**
 * Replaces a place's photo.
 *
 * Uploaded with public read permission on purpose: in Week 3 these images load on
 * a stranger's website straight from storage. An authenticated URL would put a
 * request we pay for into the visitor's path, which CLAUDE.md §2 forbids.
 */
export async function setPlacePhoto(
  ctx: RepoContext,
  mapId: string,
  placeId: string,
  file: File,
): Promise<Place> {
  // Ownership check first — nothing is uploaded for a place the caller can't edit.
  const place = await getPlace(ctx, mapId, placeId);

  assertUploadable(file);

  let uploadedId: string;

  try {
    const uploaded = await admin.storage.createFile({
      bucketId: env.storageId,
      fileId: ID.unique(),
      file,
      permissions: [
        Permission.read(Role.any()),
        // Only the owner can replace or remove it; writes still go through us.
        Permission.update(Role.user(ctx.userId)),
        Permission.delete(Role.user(ctx.userId)),
      ],
    });

    uploadedId = uploaded.$id;
  } catch (error) {
    throw toRepositoryError(error);
  }

  try {
    const row = await admin.tablesDB.updateRow<PlaceRow>({
      databaseId: env.databaseId,
      tableId: TABLES.places,
      rowId: placeId,
      data: { photoId: uploadedId },
    });

    // Only once the row points at the new file. Deleting first would leave the
    // place showing a broken image if the update failed.
    await removeFile(place.photoId);

    return toPlace(row);
  } catch (error) {
    // The row still references the old photo, so the orphan is the new upload.
    await removeFile(uploadedId);
    throw toRepositoryError(error);
  }
}

export async function clearPlacePhoto(
  ctx: RepoContext,
  mapId: string,
  placeId: string,
): Promise<Place> {
  const place = await getPlace(ctx, mapId, placeId);

  try {
    const row = await admin.tablesDB.updateRow<PlaceRow>({
      databaseId: env.databaseId,
      tableId: TABLES.places,
      rowId: placeId,
      data: { photoId: null },
    });

    await removeFile(place.photoId);

    return toPlace(row);
  } catch (error) {
    throw toRepositoryError(error);
  }
}

function assertUploadable(file: File): void {
  if (file.size === 0) {
    throw new RepositoryError(
      "validation_failed",
      "That file is empty. Choose a photo and try again.",
      422,
    );
  }

  if (file.size > MAX_PHOTO_BYTES) {
    throw new RepositoryError(
      "validation_failed",
      "That photo is over 5MB. Choose a smaller one.",
      422,
    );
  }

  if (!(ALLOWED_PHOTO_TYPES as readonly string[]).includes(file.type)) {
    throw new RepositoryError(
      "validation_failed",
      "That file isn't a photo. Use a JPG, PNG, WebP or AVIF.",
      422,
    );
  }
}

/**
 * Best effort. A file we failed to delete is wasted storage, not a broken place,
 * so it must never turn a successful save into an error the user sees.
 */
async function removeFile(fileId: string | null): Promise<void> {
  if (!fileId) return;

  try {
    await admin.storage.deleteFile({ bucketId: env.storageId, fileId });
  } catch (error) {
    console.error("Failed to delete storage file", fileId, error);
  }
}
