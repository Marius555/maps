"use client";

import { toast } from "@heroui/react";

import { ApiError } from "./fetcher";

/**
 * Say the plan limit out loud.
 *
 * `planLimitMessage` in lib/repositories/errors.ts composes a good sentence — what
 * you have used, out of what, on which plan, and the two ways out of it — and
 * until now the map editor made sure nobody ever read it. Being at the limit
 * disabled the add button, the drag gesture and the search's `+`, so the 403 that
 * carries the sentence was never provoked. What the user got was a grey button.
 *
 * The controls are live again and this is the other half: the attempt goes
 * through, the server refuses it, and the refusal is shown. A toast rather than
 * an alert in the sidebar because the three paths that hit this — dragging a pin,
 * clicking the map in add mode, pressing `+` in the search — all happen out on the
 * canvas, where there is no inline space to put a sentence and no reason to think
 * the user is looking at the panel.
 *
 * Sits beside `applyFieldErrors`, which does the same kind of work for forms:
 * take an ApiError, put it where it belongs, and report whether it was handled so
 * the caller can stop.
 */

const PLAN_LIMIT = "plan_limit_reached";

/**
 * True when this error is the plan limit and nothing else. Exported separately
 * because the editor needs to ask without also raising a toast — its sidebar
 * renders `createPlace.error` inline, and saying the same thing twice is the
 * habit `publish-action.tsx` already declines.
 */
export function isPlanLimit(error: unknown): error is ApiError {
  return error instanceof ApiError && error.code === PLAN_LIMIT;
}

/**
 * Raise the toast if the error is a plan limit. Returns whether it did.
 *
 * The description is the server's own sentence, unedited — it is the only place
 * that knows the count, the ceiling and the plan name, and paraphrasing it here
 * would be a second copy to keep in step.
 *
 * No action button. The sentence already names both ways out, and the nearer of
 * them — delete a location — is a list the user is looking at while they read
 * this. A button repeating half of it would be chrome that competes with the
 * words next to it. The other way out is a pricing page that does not exist yet
 * (Week 4); when it does, an "Upgrade" action here is the obvious place for it.
 *
 * The timeout is longer than the 4s default because this one has to be read
 * rather than glanced at.
 *
 * The caller names what it was adding, because the server's `resource` does not
 * survive the HTTP boundary — only the code and the message do — and the message
 * is a sentence, not a heading. It defaults to locations, which is the limit most
 * of the canvas can hit; the map limit is reached on a form instead, where the
 * message stays inline beside the button that failed.
 */
export function toastPlanLimit(error: unknown, noun = "Location"): boolean {
  if (!isPlanLimit(error)) return false;

  toast.danger(`${noun} limit reached`, {
    description: error.message,
    timeout: 8000,
  });

  return true;
}
