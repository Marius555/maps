import "server-only";

import { RepositoryError } from "@/lib/repositories/errors";
import {
  MAX_LOGO_BYTES,
  MAX_PHOTO_BYTES,
  MAX_PHOTOS_PER_PLACE,
} from "@/lib/validation/photo";

/**
 * Refuse an upload by its declared size, before a byte of it is read.
 *
 * `request.formData()` buffers the whole multipart body in memory, and the
 * per-file checks in `files.repository.ts` only run after it has — so without
 * this a single request could make the server hold whatever it was sent. The
 * ceiling is the most a legitimate request can carry (a full gallery of the
 * largest photos) plus room for the multipart framing.
 *
 * A request with no `Content-Length` is refused too. Every browser sends one
 * for a `FormData` body; only a hand-made chunked request leaves it out, and
 * that is exactly the request that would otherwise stream without limit.
 */
const FRAMING_BYTES = 64 * 1024;

export const MAX_UPLOAD_BYTES = {
  photos: MAX_PHOTOS_PER_PLACE * MAX_PHOTO_BYTES + FRAMING_BYTES,
  logo: MAX_LOGO_BYTES + FRAMING_BYTES,
  cover: MAX_PHOTO_BYTES + FRAMING_BYTES,
} as const;

export function assertUploadSize(request: Request, kind: keyof typeof MAX_UPLOAD_BYTES): void {
  const declared = Number(request.headers.get("content-length"));

  if (!Number.isFinite(declared) || declared <= 0) {
    throw new RepositoryError(
      "validation_failed",
      "That upload had no size. Choose the file again and retry.",
      411,
    );
  }

  if (declared > MAX_UPLOAD_BYTES[kind]) {
    throw new RepositoryError(
      "validation_failed",
      kind === "logo"
        ? "That logo is too large. Choose one under 512KB."
        : kind === "cover"
          ? "That cover image is too large. Choose one under 5MB."
          : `That's more than a location can hold. Add up to ${String(MAX_PHOTOS_PER_PLACE)} photos of 5MB or less.`,
      413,
    );
  }
}
