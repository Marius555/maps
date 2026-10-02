import "server-only";

import { ID, Permission, Role } from "node-appwrite";

import { admin } from "@/lib/appwrite/admin";
import { TABLES } from "@/lib/appwrite/config";
import { toRepositoryError } from "@/lib/appwrite/errors";
import { env } from "@/lib/env";
import {
  ALLOWED_PHOTO_TYPES,
  MAX_LOGO_BYTES,
  MAX_PHOTO_BYTES,
  MAX_PHOTOS_PER_PLACE,
} from "@/lib/validation/photo";
import type { RepoContext } from "./context";
import { RepositoryError } from "./errors";
import { toPlace } from "./mappers";
import { getPlace } from "./places.repository";
import type { Place, PlaceRow } from "./types";

/**
 * Anybody may read an uploaded image; nobody but the admin client may change or
 * delete it.
 *
 * Owners used to be given `update` and `delete` here, "writes still go through
 * us". They did not have to: the session cookie is the Appwrite session secret,
 * so an owner could delete a file straight through Appwrite's API — and, while
 * `places.photoIds` was owner-writable too, point it at somebody else's file and
 * delete *that* through our own photo route. See `ownerPermissions`.
 */
export const PUBLIC_FILE_PERMISSIONS = [Permission.read(Role.any())];

/**
 * A location's photos.
 *
 * Uploaded with public read permission on purpose: these images load on a
 * stranger's website straight from storage. An authenticated URL would put a
 * request we pay for into the visitor's path, which CLAUDE.md §2 forbids.
 *
 * **Every write here also clears the legacy `photoId`.** That column held the
 * single photo this array replaced, and the mapper reads it only when
 * `photoIds` is empty (see `toPlace`). Clearing it on the first write is what
 * keeps that a rule rather than a merge: a row is using one column or the other,
 * never both, so there is no second copy of the cover to disagree with the
 * first — and a location whose photos are all removed does not have its old one
 * resurrected by the fallback.
 */
export async function addPlacePhotos(
  ctx: RepoContext,
  mapId: string,
  placeId: string,
  files: File[],
): Promise<Place> {
  // Ownership check first — nothing is uploaded for a place the caller can't edit.
  const place = await getPlace(ctx, mapId, placeId);

  if (files.length === 0) {
    throw new RepositoryError(
      "validation_failed",
      "Choose a photo to upload.",
      422,
    );
  }

  if (place.photoIds.length + files.length > MAX_PHOTOS_PER_PLACE) {
    throw new RepositoryError(
      "validation_failed",
      `A location can hold ${MAX_PHOTOS_PER_PLACE} photos. Remove one before adding another.`,
      422,
    );
  }

  // All of them, before anything is uploaded: a batch that fails halfway leaves
  // the user re-picking files that were already fine.
  for (const file of files) assertUploadable(file);

  const uploaded: string[] = [];

  try {
    for (const file of files) {
      const created = await admin.storage.createFile({
        bucketId: env.storageId,
        fileId: ID.unique(),
        file,
        permissions: PUBLIC_FILE_PERMISSIONS,
      });

      uploaded.push(created.$id);
    }
  } catch (error) {
    // Whatever landed before the failure is an orphan nothing points at.
    await removeFiles(uploaded);
    throw toRepositoryError(error);
  }

  try {
    return await writePhotoIds(placeId, [...place.photoIds, ...uploaded]);
  } catch (error) {
    // The row never referenced these, so the orphans are the new uploads.
    await removeFiles(uploaded);
    throw toRepositoryError(error);
  }
}

/** Drops one photo. Unknown ids are a no-op, not an error — it is already gone. */
export async function removePlacePhoto(
  ctx: RepoContext,
  mapId: string,
  placeId: string,
  photoId: string,
): Promise<Place> {
  const place = await getPlace(ctx, mapId, placeId);
  const kept = place.photoIds.filter((id) => id !== photoId);

  if (kept.length === place.photoIds.length) return place;

  try {
    const updated = await writePhotoIds(placeId, kept);

    // Only once the row has stopped pointing at it. Deleting first would leave
    // the place showing a broken image if the update failed.
    await removeFiles([photoId]);

    return updated;
  } catch (error) {
    throw toRepositoryError(error);
  }
}

/**
 * Reorders the gallery — which is how the cover is chosen, since the cover is
 * simply the first one.
 *
 * Rejects anything that is not a permutation of what the row already holds. A
 * reorder that could add or drop an id would be a second way to write the
 * gallery, with none of the storage bookkeeping the other two do — an id
 * dropped here would leak a file nothing points at, and an id added would name
 * a file we never uploaded.
 */
export async function reorderPlacePhotos(
  ctx: RepoContext,
  mapId: string,
  placeId: string,
  photoIds: string[],
): Promise<Place> {
  const place = await getPlace(ctx, mapId, placeId);

  if (!isPermutation(place.photoIds, photoIds)) {
    throw new RepositoryError(
      "validation_failed",
      "Those photos are out of date. Reopen the location and try again.",
      409,
    );
  }

  try {
    return await writePhotoIds(placeId, photoIds);
  } catch (error) {
    throw toRepositoryError(error);
  }
}

export async function clearPlacePhotos(
  ctx: RepoContext,
  mapId: string,
  placeId: string,
): Promise<Place> {
  const place = await getPlace(ctx, mapId, placeId);

  try {
    const updated = await writePhotoIds(placeId, []);

    await removeFiles(place.photoIds);

    return updated;
  } catch (error) {
    throw toRepositoryError(error);
  }
}

/**
 * A location's own brand mark, replacing whatever it had.
 *
 * One file, so this is a set rather than an append — and the old file is deleted
 * only **after** the row has stopped pointing at it. The other order loses the
 * logo outright if the row write fails, where this one leaves a file nothing
 * references, which `removeFiles` already treats as the survivable half of the
 * pair.
 *
 * Modelled on `addPlacePhotos` down to the permissions, and for its reason: a
 * logo is drawn on a stranger's website straight from storage, so it is publicly
 * readable and costs the visitor's path nothing (CLAUDE.md §2).
 */
export async function setPlaceLogo(
  ctx: RepoContext,
  mapId: string,
  placeId: string,
  file: File,
): Promise<Place> {
  // Ownership check first — nothing is uploaded for a place the caller can't edit.
  const place = await getPlace(ctx, mapId, placeId);

  assertUploadable(file, "logo");

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

  let updated: Place;

  try {
    updated = await writeLogoId(placeId, uploaded);
  } catch (error) {
    // The row never referenced it, so the orphan is the new upload.
    await removeFiles([uploaded]);
    throw toRepositoryError(error);
  }

  if (place.logoId) await removeFiles([place.logoId]);

  return updated;
}

/** Drops the logo. A location with none is a no-op, not an error. */
export async function clearPlaceLogo(
  ctx: RepoContext,
  mapId: string,
  placeId: string,
): Promise<Place> {
  const place = await getPlace(ctx, mapId, placeId);

  if (!place.logoId) return place;

  try {
    const updated = await writeLogoId(placeId, null);

    await removeFiles([place.logoId]);

    return updated;
  } catch (error) {
    throw toRepositoryError(error);
  }
}

/** The one place the logo column is written. */
async function writeLogoId(
  placeId: string,
  logoId: string | null,
): Promise<Place> {
  const row = await admin.tablesDB.updateRow<PlaceRow>({
    databaseId: env.databaseId,
    tableId: TABLES.places,
    rowId: placeId,
    data: { logoId },
  });

  return toPlace(row);
}

/**
 * The one place the photo columns are written.
 *
 * `photoId: null` on every write is the whole compatibility story — see the
 * note at the top of this file.
 */
async function writePhotoIds(
  placeId: string,
  photoIds: string[],
): Promise<Place> {
  const row = await admin.tablesDB.updateRow<PlaceRow>({
    databaseId: env.databaseId,
    tableId: TABLES.places,
    rowId: placeId,
    data: { photoIds, photoId: null },
  });

  return toPlace(row);
}

function isPermutation(a: readonly string[], b: readonly string[]): boolean {
  if (a.length !== b.length) return false;

  return [...a].sort().join(" ") === [...b].sort().join(" ");
}

/**
 * What a photo and a logo have in common, which is everything but two numbers
 * and the noun in the sentence.
 *
 * The noun matters: an error has to name the thing the user was actually doing
 * (§8), and "That photo is over 5MB" is the wrong sentence entirely when they
 * were adding a logo.
 */
const UPLOAD_KINDS = {
  photo: { noun: "photo", maxBytes: MAX_PHOTO_BYTES, maxLabel: "5MB" },
  logo: { noun: "logo", maxBytes: MAX_LOGO_BYTES, maxLabel: "512KB" },
} as const;

function assertUploadable(
  file: File,
  kind: keyof typeof UPLOAD_KINDS = "photo",
): void {
  const { noun, maxBytes, maxLabel } = UPLOAD_KINDS[kind];

  if (file.size === 0) {
    throw new RepositoryError(
      "validation_failed",
      `That file is empty. Choose a ${noun} and try again.`,
      422,
    );
  }

  if (file.size > maxBytes) {
    throw new RepositoryError(
      "validation_failed",
      `That ${noun} is over ${maxLabel}. Choose a smaller one.`,
      422,
    );
  }

  if (!(ALLOWED_PHOTO_TYPES as readonly string[]).includes(file.type)) {
    throw new RepositoryError(
      "validation_failed",
      `That file isn't an image. Use a JPG, PNG, WebP or AVIF.`,
      422,
    );
  }
}

/**
 * Best effort. A file we failed to delete is wasted storage, not a broken place,
 * so it must never turn a successful save into an error the user sees.
 */
async function removeFiles(fileIds: readonly string[]): Promise<void> {
  for (const fileId of fileIds) {
    if (!fileId) continue;

    try {
      await admin.storage.deleteFile({ bucketId: env.storageId, fileId });
    } catch (error) {
      console.error("Failed to delete storage file", fileId, error);
    }
  }
}
