import Link from "next/link";

import type { FaqItem } from "@/components/marketing/integrations/faq-accordion";
import { SHOPIFY_PRICES } from "@/lib/billing/shopify-pricing";
import { BRAND } from "@/lib/brand";

/**
 * The questions a merchant asks before installing an app. Every answer is a
 * fact about what ships, from docs/notes/shopify.md — accounts, billing, the
 * import, the block's settings, the uninstall webhooks — or a published limit.
 * The prices are `SHOPIFY_PRICES`, the figures Settings → Billing shows, so the
 * page and the app cannot quote different numbers.
 */
export const SHOPIFY_FAQ: readonly FaqItem[] = [
  {
    question: `Do I need a ${BRAND.name} account?`,
    answer:
      "No. Installing the app makes your store its own workspace, with your maps in it. Your staff open the same app and work on the same maps.",
  },
  {
    question: "What does it cost?",
    answer: (
      <>
        The app is free, and so is a map of up to 25 locations, with a small “Made with{" "}
        {BRAND.name}” link. Starter is {SHOPIFY_PRICES.starter.monthly} and Pro{" "}
        {SHOPIFY_PRICES.pro.monthly} ({SHOPIFY_PRICES.starter.yearly} and{" "}
        {SHOPIFY_PRICES.pro.yearly}), billed by Shopify on your Shopify invoice. No plan
        charges for views.
      </>
    ),
  },
  {
    question: "Can I import my store’s locations?",
    answer:
      "Yes. Press Import from Shopify and allow Locations access when Shopify asks — the app asks only then, not at install. They arrive with Shopify’s own coordinates, ready to review. You can import a spreadsheet instead.",
  },
  {
    question: "Does it work with my theme?",
    answer:
      "With any theme that supports app blocks — every Online Store 2.0 theme, Dawn included. Add the Pinglide map block in the theme editor like any other block.",
  },
  {
    question: "Can different pages show different maps?",
    answer:
      "Yes. Each block picks a map by name in the theme editor. Left empty, it shows your default map — the first one you put on your storefront.",
  },
  {
    question: "Can I choose how big the map is?",
    answer: "Yes. The block has a height, and a separate height on phones if you want one.",
  },
  {
    question: "Will it slow my store down?",
    answer:
      "The map waits until a shopper scrolls near it, then loads static files from a CDN — nothing calls the app per visitor. For a map at the top of a page, “Load the map straight away” in the block’s settings turns the wait off.",
  },
  {
    question: "Does my map update when I edit it?",
    answer: `Yes. Edit in ${BRAND.name} and press Redeploy — your store shows the new version by itself. Nothing changes on your store until you do.`,
  },
  {
    question: "What happens if I uninstall?",
    answer: (
      <>
        The map leaves your store and your plan ends. Your maps are kept for 48 hours, so
        reinstalling finds them; after that Shopify asks us to erase your store’s data, and we
        do. See the <Link href="/privacy">privacy policy</Link>.
      </>
    ),
  },
];
