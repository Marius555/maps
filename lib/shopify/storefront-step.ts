/**
 * Which button is the main one in the Shopify app's Publish footer
 * (docs/notes/shopify.md, "Storefront"). Exactly one at a time, so the path
 * onto the store reads as a path: show the map, add the block, then publish
 * edits.
 *
 * - `"show"` — step 1, Show on storefront.
 * - `"theme"` — step 2, Add to theme.
 * - `"publish"` — Publish.
 * - `null` — none yet, while the storefront status is loading.
 *
 * Step 2 is never known to be done: telling whether the block is in the theme
 * needs `read_themes`, which the app does not ask for. So it leads when there
 * is nothing else to do, and right after step 1 succeeds, which is the moment
 * the merchant needs it.
 */
export type StorefrontPrimary = "show" | "theme" | "publish" | null;

export function storefrontPrimary({
  onStorefront,
  isError,
  justShown,
  hasPendingChanges,
}: {
  /** `undefined` until the storefront status has answered. */
  onStorefront: boolean | undefined;
  /** The storefront status could not be read. */
  isError: boolean;
  /** Step 1 succeeded on this visit to the page. */
  justShown: boolean;
  hasPendingChanges: boolean;
}): StorefrontPrimary {
  // With no answer about the storefront, Publish is still something the
  // merchant can do, and it is what the page offers everybody else.
  if (onStorefront === undefined) return isError ? "publish" : null;
  if (!onStorefront) return "show";
  if (justShown) return "theme";

  return hasPendingChanges ? "publish" : "theme";
}
