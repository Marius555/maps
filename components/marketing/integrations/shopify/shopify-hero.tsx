import Link from "next/link";

import { PlatformHero } from "../platform-hero";
import { ThemeEditorArt } from "./art/shopify-art-loader";
import { ShopifyActions, SHOPIFY_LISTED } from "./shopify-actions";

/**
 * The top of /for/shopify: what the app is, the way in, and the drawing of the
 * block going into a theme. Until the App Store listing is live the note under
 * the buttons gives the way that works today, the embed code.
 */
export function ShopifyHero() {
  return (
    <PlatformHero
      icon="shopify"
      platform="Shopify"
      title={
        <>
          Your locations, on your <span className="text-accent">Shopify</span> store.
        </>
      }
      lede="An app in your admin and a map block for your theme. Bring in your store’s locations and add the block to any page — no code, no API key, billed through Shopify."
      actions={<ShopifyActions />}
      note={
        SHOPIFY_LISTED ? (
          "Free plan · Works with any theme that supports app blocks."
        ) : (
          <>
            On Shopify today?{" "}
            <Link href="/for/any-website" className="text-foreground underline underline-offset-2">
              Paste your embed code
            </Link>{" "}
            into a Custom Liquid section.
          </>
        )
      }
      art={<ThemeEditorArt />}
    />
  );
}
