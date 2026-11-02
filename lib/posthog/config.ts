/**
 * Whether PostHog is on, and where it is — read by both halves: the browser's
 * loader (`./client.ts`) and the server's capture (`./server.ts`).
 *
 * A plain module on purpose. `./client.ts` is `"use client"`, and a value a
 * server module imports from one arrives as a client reference, not the value
 * (CLAUDE.md, "Stack specifics") — so a shared constant has to live here.
 *
 * Both variables are optional. Unset — or with `NEXT_PUBLIC_DISABLE_POSTHOG=true`,
 * which switches it off locally without deleting them — nothing is sent from
 * either side.
 */
export const posthogProjectToken = process.env.NEXT_PUBLIC_POSTHOG_PROJECT_TOKEN;
export const posthogHost = process.env.NEXT_PUBLIC_POSTHOG_HOST;

export const isPostHogEnabled = Boolean(
  posthogProjectToken && posthogHost && process.env.NEXT_PUBLIC_DISABLE_POSTHOG !== "true",
);
