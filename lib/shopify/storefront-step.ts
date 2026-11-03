/**
 * The three steps of the Shopify app's Publish footer, top to bottom
 * (docs/notes/shopify.md, "The Publish footer inside Shopify"):
 *
 * 1. Show on storefront — the map goes on the shop's list for the theme block.
 * 2. Add to theme — the block goes into the theme.
 * 3. Publish — edits reach the store.
 *
 * At most one step is `current`, and its button is the only filled one, so the
 * path reads as a path. Every step before it is `done`, every step after it
 * `upcoming`. With all three done there is nothing to press, and nothing is
 * filled — the stepper does not draw step 3 then, and step 2 offers "Go to
 * theme", unfilled.
 *
 * **Redeploy is offered only when there is something to send** — edits since
 * the last publish, or no publish at all (`needsPublish`). The owner did not
 * want a button that republishes an identical map.
 *
 * **Step 2 is "done" only as far as this browser remembers** (`themeAdded`):
 * telling whether the block is really in the theme needs `read_themes`, which
 * the app does not ask for. Forgetting it costs nothing worse than step 2
 * showing again, because Publish is on screen in every state.
 */
export type StepState = "done" | "current" | "upcoming";

export type StorefrontAction = "show" | "theme" | "publish";

export type StorefrontSteps = {
  /** `null` while the storefront status is loading or could not be read. */
  steps: { show: StepState; theme: StepState; publish: StepState } | null;
  /** The one filled button, or `null` for none. */
  primary: StorefrontAction | null;
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
  /** Add to theme (or "Already added") was pressed for this map, in this browser. */
  themeAdded: boolean;
  hasPendingChanges: boolean;
  /** The map has been published at least once. */
  published: boolean;
}): StorefrontSteps {
  const toPublish = needsPublish({ hasPendingChanges, published });

  // With no answer about the storefront, Redeploy is still something the
  // merchant can do — when there is anything to redeploy.
  if (onStorefront === undefined) {
    return { steps: null, primary: isError && toPublish ? "publish" : null };
  }

  if (!onStorefront) {
    return { steps: { show: "current", theme: "upcoming", publish: "upcoming" }, primary: "show" };
  }

  if (!themeAdded) {
    return { steps: { show: "done", theme: "current", publish: "upcoming" }, primary: "theme" };
  }

  if (toPublish) {
    return { steps: { show: "done", theme: "done", publish: "current" }, primary: "publish" };
  }

  return { steps: { show: "done", theme: "done", publish: "done" }, primary: null };
}

/** The store is behind the editor, or the map has never been published. */
export function needsPublish({
  hasPendingChanges,
  published,
}: {
  hasPendingChanges: boolean;
  published: boolean;
}): boolean {
  return hasPendingChanges || !published;
}
