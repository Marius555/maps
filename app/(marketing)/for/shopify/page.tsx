import type { Metadata } from "next";

import { IntegrationClosing } from "@/components/marketing/integrations/integration-closing";
import {
  ShopifyActions,
  SHOPIFY_LISTED,
} from "@/components/marketing/integrations/shopify/shopify-actions";
import { SHOPIFY_FAQ } from "@/components/marketing/integrations/shopify/shopify-faq";
import { ShopifyHero } from "@/components/marketing/integrations/shopify/shopify-hero";
import { ShopifySteps } from "@/components/marketing/integrations/shopify/shopify-steps";
import { ShopifyWhy } from "@/components/marketing/integrations/shopify/shopify-why";
import { SnapPage } from "@/components/marketing/snap-page";

const DESCRIPTION =
  "Put your stores, stockists or venues on a map on your Shopify store. An app block for your theme — no code, no API key, billed through Shopify, no per-view charge.";

export const metadata: Metadata = {
  title: "Maps for Shopify",
  description: DESCRIPTION,
  openGraph: {
    title: "Maps for Shopify",
    description: DESCRIPTION,
    type: "website",
  },
};

/**
 * The Shopify app's public page, beside /for/wordpress in the navbar's
 * Integrations menu. Shaped like it and like the landing page — a screen at a
 * time (`SnapPage`), the hero, the three steps, why a block, and the questions
 * beside the way in — because it does the same job for one platform.
 *
 * **Every claim is true of what ships**, and docs/notes/shopify.md is the
 * source: re-read the page when the app's labels or its billing change. The
 * install button waits on `SHOPIFY_APP_STORE_URL` (lib/marketing/integrations.ts):
 * until the listing is live, the page says so and offers the embed code.
 *
 * Statically rendered; reads no request input.
 */
export default function ShopifyIntegrationPage() {
  return (
    <SnapPage>
      <ShopifyHero />
      <ShopifySteps />
      <ShopifyWhy />
      <IntegrationClosing
        items={SHOPIFY_FAQ}
        title={
          <>
            Your stores, on your <span className="text-accent">storefront</span>.
          </>
        }
        lede={
          SHOPIFY_LISTED
            ? "Start on the free plan. Upgrade from inside the app when your map outgrows it."
            : "The app is on its way to the Shopify App Store. Until then, a free map and one line of embed code put it on your store today."
        }
        actions={<ShopifyActions />}
      />
    </SnapPage>
  );
}
