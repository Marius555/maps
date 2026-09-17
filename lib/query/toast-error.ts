"use client";

import { toast } from "@heroui/react";

import { ApiError } from "./fetcher";

/**
 * Say a failure out loud when there is no dialog left to say it in.
 *
 * The pattern in this codebase is that a mutation's error renders inline, beside
 * the control that failed. That works while the control is still on screen, and
 * a gesture whose whole point is that it completes optimistically has no such
 * place: ungrouping closes its dialog the instant it is confirmed, precisely so
 * the rows can be seen travelling out of the group. If the request then fails,
 * the panel puts the group back — silently, which reads as the click never having
 * landed.
 *
 * Sits beside `toastPlanLimit`, which does the same job for the one error that
 * already has its own sentence. This is the general case: the caller names what
 * did not happen, and the server's own message fills in why when it has one.
 */
export function toastError(error: unknown, title: string): void {
  toast.danger(title, {
    description:
      error instanceof ApiError
        ? error.message
        : "Something broke on our side. Try again in a moment.",
    timeout: 8000,
  });
}

const GENERIC_PROBLEM = "Something broke on our side. Try again in a moment.";

/**
 * Report the outcome of something the user just did, when that outcome is a
 * refusal with its own instructions.
 *
 * `toastError` covers a server error behind an optimistic gesture. This covers
 * the import flow's failures, which are more often a sentence we wrote on the
 * client — "That sheet isn't shared. In Google Sheets choose Share → …" — than
 * a response, so a plain string is accepted as the message as well. Anything
 * else gets `fallback`, which the caller can make specific to what was tried.
 *
 * These used to be inline alerts under the control, and every one of them moved
 * the page when it appeared. The rule that decides which way a message goes: an
 * error about something that just happened is a toast; a message explaining why
 * a button is disabled stays beside the button, because a toast would expire
 * and leave the button unexplained.
 *
 * Ten seconds rather than eight: several of these are instructions to follow in
 * another tab, and they are long.
 */
export function toastProblem(
  title: string,
  problem: unknown,
  fallback: string = GENERIC_PROBLEM,
): void {
  toast.danger(title, {
    description:
      typeof problem === "string"
        ? problem
        : problem instanceof ApiError
          ? problem.message
          : fallback,
    timeout: 10000,
  });
}
