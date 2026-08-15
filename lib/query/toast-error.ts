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
