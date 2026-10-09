"use client";

import posthog from "posthog-js";

import type { AuthUser } from "@/lib/auth/types";

/**
 * Product analytics for the dashboard and the marketing site — **never the
 * embed.** PostHog bills per event, and a published map's traffic is a
 * stranger's, unbounded (§2). `eslint.config.mjs` already keeps `@/lib` out of
 * `/embed`; this note is why that matters here too.
 *
 * Both variables are optional. Unset — or with `NEXT_PUBLIC_DISABLE_POSTHOG=true`,
 * which switches it off locally without deleting them — every function below
 * is a no-op and `instrumentation-client.ts` never calls `init`.
 */
export const isPostHogEnabled = Boolean(
  process.env.NEXT_PUBLIC_POSTHOG_PROJECT_TOKEN &&
    process.env.NEXT_PUBLIC_POSTHOG_HOST &&
    process.env.NEXT_PUBLIC_DISABLE_POSTHOG !== "true",
);

export function track(event: string, properties?: Record<string, unknown>): void {
  if (!isPostHogEnabled) return;
  posthog.capture(event, properties);
}

// Prevents a login callback and the dashboard refresh boundary from identifying
// the same person twice in one document. A full page refresh evaluates this
// module again, which deliberately identifies the already-signed-in user —
// and has to, because persistence is in memory only and a reload forgets them.
let identifiedUserId: string | null = null;

/**
 * Identifies with Appwrite's immutable account ID. Email and display name are
 * person properties, never event properties.
 */
export function identifyUser(user: AuthUser): void {
  if (!isPostHogEnabled || identifiedUserId === user.id) return;

  posthog.identify(user.id, {
    email: user.email,
    name: user.name,
  });
  identifiedUserId = user.id;
}

export function resetUser(): void {
  identifiedUserId = null;
  if (!isPostHogEnabled) return;
  posthog.reset();
}
