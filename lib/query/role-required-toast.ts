"use client";

import { toast } from "@heroui/react";

import { ApiError } from "./fetcher";

/**
 * Say why an edit did not land, when a team's viewer — or an editor reaching
 * for an admin's control — found a gesture the dashboard did not hide.
 *
 * The visible rules are the "View only" banner and the controls that are not
 * drawn for a viewer (components/team/role-context.tsx). This covers every write
 * behind a gesture that was never hidden: the server refuses it with
 * `role_required`, and without a word a refused drag reads as a broken map. The
 * same reasoning, and the same place, as `verify-email-toast.ts`: raised once
 * from the `MutationCache` in `client.ts`, so a mutation written next month is
 * covered by having been written normally.
 *
 * The description is the server's own sentence — it already names who can help.
 */

const ROLE_REQUIRED = "role_required";

export function isRoleRequired(error: unknown): error is ApiError {
  return error instanceof ApiError && error.code === ROLE_REQUIRED;
}

/** Raise the toast if the error is the role gate. Returns whether it did. */
export function toastRoleRequired(error: unknown): boolean {
  if (!isRoleRequired(error)) return false;

  toast.warning("You can't change that", {
    description: error.message,
    timeout: 8000,
  });

  return true;
}
