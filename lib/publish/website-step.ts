import { statesAt, type StepStates } from "./steps";

/**
 * The three steps of the Publish footer outside the Shopify admin, "Your
 * website" — the twin of "Your store" (`lib/shopify/storefront-step.ts`), for
 * a map that goes onto a site by its embed code (docs/notes/publish-and-embed.md,
 * "The Your website stepper"):
 *
 *   ① Publish your map — the first publish, which is what makes a snippet exist.
 *   ② Add it to your website — the snippet goes onto the site (Get embed code).
 *   ③ Up to date — a status: the site shows the latest map, or Redeploy.
 *
 * Fixed and in this order (`lib/publish/steps.ts`); at most one is current and
 * its button is the only filled one. **With edits and ② not done, Redeploy
 * comes first, inside ②**, which then turns into Get embed code in the same
 * place — the owner's call (2026-11-07), and the same rule as the theme step.
 *
 * **The embed step is "done" only as far as this browser remembers**
 * (`embedAdded`): nothing can tell whether a snippet is on somebody's site. A
 * successful Copy embed code, or "Already added", records it. `undefined`
 * until the browser has been read, so the first paint never shows a state that
 * flips a moment later.
 *
 * **A team viewer is never shown Redeploy first** (`canPublish`). They reach
 * this page for the snippet, cannot publish, and must not find Get embed code
 * waiting behind a button they cannot press. With the snippet marked and edits
 * waiting, ③ is current for them too — it is not up to date — and says why
 * nothing on it can be pressed.
 */
export const WEBSITE_STEPS = ["publish", "embed", "live"] as const;

export type WebsiteStep = (typeof WEBSITE_STEPS)[number];

/** What the one filled button does. `redeploy` sits in ② or ③, whichever is current. */
export type WebsitePrimary = "publish" | "embed" | "redeploy";

export type WebsiteSteps = {
  /** `null` only until the browser's "added" mark has been read. */
  steps: StepStates<WebsiteStep> | null;
  primary: WebsitePrimary | null;
};

export function websiteSteps({
  published,
  hasPendingChanges,
  embedAdded,
  canPublish,
}: {
  /** The map has been published at least once. */
  published: boolean;
  hasPendingChanges: boolean;
  /** Copy embed code (or "Already added") was pressed for this map, in this browser. `undefined` until read. */
  embedAdded: boolean | undefined;
  /** Not a team viewer. */
  canPublish: boolean;
}): WebsiteSteps {
  // Before the first publish nothing else matters, so this needs no wait.
  if (!published) {
    return { steps: statesAt(WEBSITE_STEPS, 0), primary: canPublish ? "publish" : null };
  }

  if (embedAdded === undefined) return { steps: null, primary: null };

  if (!embedAdded) {
    return {
      steps: statesAt(WEBSITE_STEPS, 1),
      primary: canPublish && hasPendingChanges ? "redeploy" : "embed",
    };
  }

  return hasPendingChanges
    ? { steps: statesAt(WEBSITE_STEPS, 2), primary: canPublish ? "redeploy" : null }
    : { steps: statesAt(WEBSITE_STEPS, 3), primary: null };
}
