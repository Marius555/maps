import Link from "next/link";

import type { FaqItem } from "@/components/marketing/integrations/integration-faq";
import { BRAND } from "@/lib/brand";

/**
 * The first three are the plugin's own readme.txt FAQ, in its words. The rest
 * are the questions a site owner asks before installing anything; each answer
 * is a fact about what ships (docs/notes/distribution.md) or a published limit
 * (`lib/limits/`, /pricing) — no promise the code does not keep.
 */
export const WORDPRESS_FAQ: readonly FaqItem[] = [
  {
    question: "Do I need an API key?",
    answer: "No. The set-up button links the block to your map; there is nothing to copy.",
  },
  {
    question: "Can I have several maps on one site?",
    answer: "Yes. Every block is set up on its own and shows its own map.",
  },
  {
    question: "What happens if I deactivate the plugin?",
    answer: `The maps disappear from your pages, and come back when you reactivate it. Deleting the plugin forgets which map each block showed; your maps stay in your ${BRAND.name} account.`,
  },
  {
    question: "Does it work on WordPress.com?",
    answer:
      "Yes, on a WordPress.com plan that lets you install plugins. On a plan that doesn’t, paste your map’s embed code into a Custom HTML block instead, where your plan allows it.",
  },
  {
    question: "Will it slow my page down?",
    answer:
      "The map waits until a visitor scrolls near it, then loads static files from a CDN. The plugin itself adds nothing to pages without a map.",
  },
  {
    question: "Does my map update when I change my locations?",
    answer: `Yes. Edit on ${BRAND.name} and press Publish — the WordPress page shows the new version by itself. Nothing changes on your site until you publish.`,
  },
  {
    question: "What does it cost?",
    answer: (
      <>
        The plugin is free, and so is a map of up to 25 locations, with a small
        “Made with {BRAND.name}” link. Paid plans add more maps and locations. No
        plan charges for views. See <Link href="/pricing">pricing</Link>.
      </>
    ),
  },
];
