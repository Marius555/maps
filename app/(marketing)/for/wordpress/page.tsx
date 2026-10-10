import type { Metadata } from "next";

import { IntegrationCta } from "@/components/marketing/integrations/integration-cta";
import { IntegrationFaq } from "@/components/marketing/integrations/integration-faq";
import { WORDPRESS_FAQ } from "@/components/marketing/integrations/wordpress/wordpress-faq";
import { WordPressHero } from "@/components/marketing/integrations/wordpress/wordpress-hero";
import { WordPressOtherWays } from "@/components/marketing/integrations/wordpress/wordpress-other-ways";
import { WordPressSteps } from "@/components/marketing/integrations/wordpress/wordpress-steps";
import { WordPressWhy } from "@/components/marketing/integrations/wordpress/wordpress-why";

const DESCRIPTION =
  "Put your stores, stockists or venues on a map on your WordPress site. A map block that sets itself up — no API key, no code, no per-view charge.";

export const metadata: Metadata = {
  title: "Maps for WordPress",
  description: DESCRIPTION,
  openGraph: {
    title: "Maps for WordPress",
    description: DESCRIPTION,
    type: "website",
  },
};

/**
 * The first of the per-platform pages CLAUDE.md §5 reserves at `/for/[platform]`,
 * reached from the navbar's Integrations menu (`lib/marketing/integrations.ts`).
 * A static folder rather than a dynamic segment, the way the guides are one
 * folder per article: each platform's page says different things, so a shared
 * template would be a switch statement wearing a route.
 *
 * Statically rendered; reads no request input.
 */
export default function WordPressIntegrationPage() {
  return (
    <>
      <WordPressHero />
      <WordPressSteps />
      <WordPressWhy />
      <WordPressOtherWays />
      <IntegrationFaq items={WORDPRESS_FAQ} />
      <IntegrationCta
        title={
          <>
            Your map, on your WordPress page <span className="text-accent">today</span>.
          </>
        }
        lede="Start on the free plan, with the free plugin. Upgrade when your map outgrows it."
      />
    </>
  );
}
