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

/**
 * How many photos one location may carry.
 *
 * Every one of these is a full-size image a visitor's browser may be asked to
 * download on a customer's page, and the card shows them one at a time — past a
 * handful nobody is stepping through them. Eight is also what a shop with a
 * storefront, an interior and a few products actually needs.
 */
export const MAX_PHOTOS_PER_PLACE = 8;

export const ALLOWED_PHOTO_TYPES = [
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/avif",
] as const;
