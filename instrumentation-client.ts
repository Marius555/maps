import { isPostHogEnabled, loadPostHog } from "@/lib/posthog/client";

/**
 * PostHog for the dashboard and the marketing site. Next runs this file on its
 * own pages only — the embed, the snapshots and the static `/embed/*.html`
 * harness pages never load it, which is what keeps PostHog's per-event billing
 * out of the visitor path (§2).
 *
 * **Started once the page is idle, not here and now.** This file runs before
 * hydration, and an eager `posthog.init` put ~100 KB of script and its start-up
 * work in front of the page becoming interactive. The init options and the
 * reasons for them live with the loader in `lib/posthog/client.ts`.
 */
if (isPostHogEnabled && typeof window !== "undefined") {
  const start = () => void loadPostHog();
  const whenIdle = () => {
    if ("requestIdleCallback" in window) window.requestIdleCallback(start, { timeout: 4000 });
    else setTimeout(start, 1500);
  };

  if (document.readyState === "complete") whenIdle();
  else window.addEventListener("load", whenIdle, { once: true });
}
