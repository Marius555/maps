import posthog from "posthog-js";

import { isPostHogEnabled } from "@/lib/posthog/client";

/**
 * PostHog for the dashboard and the marketing site. Next runs this file on its
 * own pages only — the embed, the snapshots and the static `/embed/*.html`
 * harness pages never load it, which is what keeps PostHog's per-event billing
 * out of the visitor path (§2).
 *
 * **`persistence: "memory"` is the cookie policy, not a tuning choice.** It
 * promises no analytics cookies and nothing stored on the device, so PostHog
 * keeps its id in memory and forgets it on a full reload. Signed-in people are
 * re-identified on every dashboard load by `PostHogIdentify`; anonymous
 * marketing visitors are a new id per document, which is the price of having
 * no consent banner.
 *
 * The operator console and the dev pages are dropped in `before_send` so they
 * never land in the customer funnel.
 */
const projectToken = process.env.NEXT_PUBLIC_POSTHOG_PROJECT_TOKEN;
const host = process.env.NEXT_PUBLIC_POSTHOG_HOST;

const IGNORED_PATHS = ["/admin", "/login/admin", "/dev"];

function isIgnoredPath(url: unknown): boolean {
  if (typeof url !== "string") return false;
  try {
    const { pathname } = new URL(url);
    return IGNORED_PATHS.some(
      (path) => pathname === path || pathname.startsWith(`${path}/`),
    );
  } catch {
    return false;
  }
}

if (isPostHogEnabled && projectToken && host) {
  try {
    posthog.init(projectToken, {
      api_host: host,
      defaults: "2026-01-30",
      persistence: "memory",
      capture_exceptions: true,
      debug: process.env.NODE_ENV === "development",
      before_send: (event) =>
        event && isIgnoredPath(event.properties?.$current_url) ? null : event,
    });
  } catch (error) {
    // Analytics must never be what stops the app from becoming interactive.
    console.warn("PostHog did not initialise:", error);
  }
}
