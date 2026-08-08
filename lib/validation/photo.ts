/**
 * Photo upload constraints.
 *
 * Client-safe on purpose: the upload button needs the accept list and the size
 * limit for its hint, and the repository needs them to enforce. Putting them in
 * the repository would drag `server-only` into a client component and fail the
 * build.
 *
 * These mirror the bucket configuration in scripts/appwrite-schema.mjs. Change
 * both together.
 */

export const MAX_PHOTO_BYTES = 5 * 1024 * 1024;

export const ALLOWED_PHOTO_TYPES = [
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/avif",
] as const;
