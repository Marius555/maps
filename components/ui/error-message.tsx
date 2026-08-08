"use client";

import { Alert } from "@heroui/react";

import { ApiError } from "@/lib/query/fetcher";

/**
 * Renders a failure. The wording is owned by whoever raised it (CLAUDE.md §8),
 * so this never invents copy — it only falls back when handed something it can't
 * read.
 *
 * A plain string is accepted as well as a thrown error: client-side validation
 * (a CSV that can't be parsed, a column mapping that doesn't add up) produces
 * deliberate user-facing sentences with no Error object attached, and routing
 * those through the generic branch would throw away the useful half of the
 * message.
 *
 * Not for field-level validation — that belongs in `FieldError` inside the field,
 * where a screen reader will associate it with the input.
 */
export function ErrorMessage({ error }: { error: unknown }) {
  if (!error) return null;

  const message = resolveMessage(error);

  return (
    <Alert status="danger" role="alert">
      <Alert.Indicator />
      <Alert.Content>
        <Alert.Description>{message}</Alert.Description>
      </Alert.Content>
    </Alert>
  );
}

function resolveMessage(error: unknown): string {
  if (typeof error === "string") return error;
  if (error instanceof ApiError) return error.message;

  // Anything else is unexpected, so say so rather than leaking an internal
  // string the user can't act on.
  return "Something broke on our side. Try again in a moment.";
}
