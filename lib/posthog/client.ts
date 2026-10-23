"use client";

import type { PostHog } from "posthog-js";

import type { AuthUser } from "@/lib/auth/types";

/**
 * Product analytics for the dashboard and the marketing site — **never the
 * embed.** PostHog bills per event, and a published map's traffic is a
 * stranger's, unbounded (§2). `eslint.config.mjs` already keeps `@/lib` out of
 * `/embed`; this note is why that matters here too.
 *
 * Both variables are optional. Unset — or with `NEXT_PUBLIC_DISABLE_POSTHOG=true`,
 * which switches it off locally without deleting them — every function below
 * is a no-op and `posthog-js` is never downloaded.
 *
 * **Loaded lazily, never imported statically.** `posthog-js` is ~100 KB
 * gzipped, and as a static import it sat in every page's first bundle and ran
 * before hydration. `instrumentation-client.ts` asks for it once the page is
 * idle; anything that tracks earlier simply loads it sooner. The npm module
 * drops calls made before `init` rather than queueing them, which is why
 * loading and initialising are one promise here and nothing touches the
 * instance before it resolves. The cost: an exception thrown before that idle
 * moment is not auto-captured.
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

export const isPostHogEnabled = Boolean(
  projectToken && host && process.env.NEXT_PUBLIC_DISABLE_POSTHOG !== "true",
);

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

let ready: Promise<PostHog | null> | null = null;

/** The initialised instance, loading and initialising it on first call. */
export function loadPostHog(): Promise<PostHog | null> {
  if (!isPostHogEnabled || !projectToken || !host) return Promise.resolve(null);

  ready ??= import("posthog-js")
    .then(({ default: posthog }) => {
      posthog.init(projectToken, {
        // Our own origin, relayed to `host` by the rewrites in next.config.ts:
        // tracker blocklists carry *.posthog.com. `ui_host` is where PostHog's
        // own links (toolbar, session links) should still point.
        api_host: "/rp",
        ui_host: host.replace(/^(https?:\/\/[a-z]+)\.i\./, "$1."),
        defaults: "2026-01-30",
        persistence: "memory",
        capture_exceptions: true,
        debug: process.env.NODE_ENV === "development",
        before_send: (event) =>
          event && isIgnoredPath(event.properties?.$current_url) ? null : event,
      });
      return posthog;
    })
    .catch((error: unknown) => {
      // Analytics must never be what breaks the app.
      console.warn("PostHog did not initialise:", error);
      return null;
    });
  return ready;
}

export function track(event: string, properties?: Record<string, unknown>): void {
  if (!isPostHogEnabled) return;
  void loadPostHog().then((posthog) => posthog?.capture(event, properties));
}

export function captureException(error: unknown): void {
  if (!isPostHogEnabled) return;
  void loadPostHog().then((posthog) => posthog?.captureException(error));
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

  identifiedUserId = user.id;
  void loadPostHog().then((posthog) =>
    posthog?.identify(user.id, {
      email: user.email,
      name: user.name,
    }),
  );
}

export function resetUser(): void {
  identifiedUserId = null;
  if (!isPostHogEnabled) return;
  void loadPostHog().then((posthog) => posthog?.reset());
}
