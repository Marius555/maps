"use client";

import { Alert } from "@heroui/react";

import { ApiError } from "@/lib/query/fetcher";
import { isEmailUnverified } from "@/lib/query/verify-email-toast";

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
 *
 * **One error is deliberately silent here: the email gate.** An account that has
 * not confirmed its address is refused every write in the app, so that 403 can
 * come back from any of the twenty-odd mutations whose error this component
 * renders — and it is already spoken, once, by the toast raised centrally in
 * `lib/query/client.ts`. Rendering it inline as well would put the identical
 * sentence on screen twice, and on a page with several forms, several times.
 * The rule lives here rather than at each call site for the same reason the
 * toast does: there is one of this file and twenty-six of those.
 *
 * Measured, not assumed — toggling a layer on Settings drew the toast and the
 * inline alert together before this.
 */
export function ErrorMessage({ error }: { error: unknown }) {
  if (!error) return null;
  if (isEmailUnverified(error)) return null;

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
