"use client";

import type { FieldValues, Path, UseFormSetError } from "react-hook-form";

import { ApiError } from "./fetcher";

/**
 * Land server-side validation errors on the inputs they belong to.
 *
 * The same zod schema runs on both sides, so a 422 here means the client check
 * was bypassed rather than that the messages differ — but the field still needs
 * to light up.
 *
 * Returns true when it handled the error, so callers know whether to also show a
 * form-level message.
 */
export function applyFieldErrors<T extends FieldValues>(
  error: unknown,
  setError: UseFormSetError<T>,
): boolean {
  if (!(error instanceof ApiError) || !error.fields) return false;

  let handled = false;

  for (const [field, messages] of Object.entries(error.fields)) {
    if (field === "_form" || messages.length === 0) continue;
    setError(field as Path<T>, { type: "server", message: messages[0] });
    handled = true;
  }

  return handled;
}
