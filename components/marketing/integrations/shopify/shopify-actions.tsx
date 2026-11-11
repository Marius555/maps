import { buttonVariants } from "@heroui/react";

import { LinkButton } from "@/components/ui/link-button";
import { SHOPIFY_APP_STORE_URL } from "@/lib/marketing/integrations";

import { PlatformIcon } from "../platform-icon";

/** Whether the app can be installed from the App Store yet (`SHOPIFY_APP_STORE_URL`). */
export const SHOPIFY_LISTED = SHOPIFY_APP_STORE_URL !== "";

/**
 * The way in from /for/shopify, wherever the page offers one.
 *
 * Listed: **Add to Shopify**, to the App Store — a plain `<a>` in a new tab,
 * because it leaves the site. Not listed yet: a chip saying so where the button
 * goes, which is not a link and does not look pressable, beside **Create a free
 * map**: the embed code works on a Shopify store today, so the page never ends
 * on a dead end.
 */
export function ShopifyActions() {
  if (SHOPIFY_LISTED) {
    return (
      <a
        href={SHOPIFY_APP_STORE_URL}
        target="_blank"
        rel="noopener noreferrer"
        className={buttonVariants()}
      >
        <PlatformIcon icon="shopify" className="size-4" />
        Add to Shopify
      </a>
    );
  }

  return (
    <>
      <span className="inline-flex h-10 items-center gap-2 rounded-full border border-dashed whitespace-nowrap border-foreground/25 px-4 text-sm font-medium text-muted">
        <PlatformIcon icon="shopify" className="size-4" />
        Coming soon to the Shopify App Store
      </span>
      <LinkButton href="/signup" variant="tertiary">
        Create a free map
      </LinkButton>
    </>
  );
}
