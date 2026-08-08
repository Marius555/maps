import "server-only";

import { AppwriteException } from "node-appwrite";

import {
  ConflictError,
  NotFoundError,
  RepositoryError,
  UnauthorizedError,
} from "@/lib/repositories/errors";

export function isAppwriteException(error: unknown): error is AppwriteException {
  return error instanceof AppwriteException;
}

/** True when Appwrite rejected a create because the id or a unique index collided. */
export function isConflict(error: unknown): boolean {
  return isAppwriteException(error) && error.code === 409;
}

/** True when the session is missing, expired or forged. */
export function isUnauthorized(error: unknown): boolean {
  return isAppwriteException(error) && error.code === 401;
}

export function isNotFound(error: unknown): boolean {
  return isAppwriteException(error) && error.code === 404;
}

/**
 * Translate an Appwrite failure into one of our errors.
 *
 * Anything unrecognised is returned as-is so the route layer turns it into a 500
 * with a generic message — we never leak an upstream error string to the user.
 */
export function toRepositoryError(error: unknown): unknown {
  if (!isAppwriteException(error)) return error;

  switch (error.code) {
    case 401:
      return new UnauthorizedError("Your session expired. Log in again.");
    case 404:
      return new NotFoundError();
    case 409:
      return new ConflictError("That already exists. Try a different name.");
    case 429:
      return new RepositoryError(
        "rate_limited",
        "Too many requests. Wait a moment and try again.",
        429,
      );
    default:
      return error;
  }
}
