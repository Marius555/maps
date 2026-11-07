import { needsPublish, statesAt, type StepStates } from "@/lib/publish/steps";

/**
 * The three steps of the Shopify app's Publish footer, "Your store"
 * (docs/notes/shopify.md, "The Publish footer inside Shopify"):
 *
 *   ① Show on your storefront — the map goes on the shop's list for the block.
 *   ② Add the block to your theme — the block goes into the theme.
 *   ③ Up to date — a status: the store shows the latest map, or Redeploy.
 *
 * Fixed and in this order (`lib/publish/steps.ts`); at most one is current and
 * its button is the only filled one.
 *
 * **With edits and the theme step not done, Redeploy comes first, inside
 * step ②** (the owner's call, 2026-11-07, twice over). Add to theme and
 * Redeploy are never offered together, and with edits Redeploy wins — so ②
 * shows Redeploy, then turns into Add to theme in the same place once the
 * store is current. ② is current throughout, so the path never moves back up.
 *
 * **`quietRedeploy`**: a map off the storefront (taken off, or only embedded
 * elsewhere) with edits must not be stuck with them — `prepareMapForSites`
 * publishes only when the site list changes, so Show on storefront would not
 * send them. Step ③ offers Redeploy as words then, beside the filled Show.
 *
 * **The theme step is "done" only as far as this browser remembers**
 * (`themeAdded`): knowing whether the block is really in the theme needs
 * `read_themes`, which the app does not ask for. `undefined` until the browser
 * has been read, which keeps the first paint from showing a state that then
 * flips.
 */
export const STOREFRONT_STEPS = ["show", "theme", "live"] as const;

export type StorefrontStep = (typeof STOREFRONT_STEPS)[number];

/** What the one filled button does. `redeploy` sits in ② or ③, whichever is current. */
export type StorefrontPrimary = "show" | "theme" | "redeploy";

export type StorefrontSteps = {
  /** `null` while loading, or when the storefront status could not be read. */
  steps: StepStates<StorefrontStep> | null;
  primary: StorefrontPrimary | null;
  /** Off the storefront with edits: ③ offers Redeploy as words. */
  quietRedeploy: boolean;
};

export function storefrontSteps({
  onStorefront,
  isError,
  themeAdded,
  hasPendingChanges,
  published,
}: {
  /** `undefined` until the storefront status has answered. */
  onStorefront: boolean | undefined;
  /** The storefront status could not be read. */
  isError: boolean;
  /** Add to theme (or "Already added") was pressed for this map, in this browser. `undefined` until read. */
  themeAdded: boolean | undefined;
  hasPendingChanges: boolean;
  /** The map has been published at least once. */
  published: boolean;
}): StorefrontSteps {
  const toPublish = needsPublish({ hasPendingChanges, published });

  // With no answer about the storefront, Redeploy is still something the
  // merchant can do — when there is anything to redeploy.
  if (onStorefront === undefined) {
    return { steps: null, primary: isError && toPublish ? "redeploy" : null, quietRedeploy: false };
  }

  if (themeAdded === undefined) return { steps: null, primary: null, quietRedeploy: false };

  if (!onStorefront) {
    return {
      steps: statesAt(STOREFRONT_STEPS, 0),
      primary: "show",
      quietRedeploy: published && hasPendingChanges,
    };
  }

  if (!themeAdded) {
    return {
      steps: statesAt(STOREFRONT_STEPS, 1),
      primary: toPublish ? "redeploy" : "theme",
      quietRedeploy: false,
    };
  }

  return toPublish
    ? { steps: statesAt(STOREFRONT_STEPS, 2), primary: "redeploy", quietRedeploy: false }
    : { steps: statesAt(STOREFRONT_STEPS, 3), primary: null, quietRedeploy: false };
}
