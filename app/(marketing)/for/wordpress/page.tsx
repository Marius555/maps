import type { Metadata } from "next";

import { IntegrationClosing } from "@/components/marketing/integrations/integration-closing";
import { WORDPRESS_FAQ } from "@/components/marketing/integrations/wordpress/wordpress-faq";
import { WordPressHero } from "@/components/marketing/integrations/wordpress/wordpress-hero";
import { WordPressOtherWays } from "@/components/marketing/integrations/wordpress/wordpress-other-ways";
import { WordPressSteps } from "@/components/marketing/integrations/wordpress/wordpress-steps";
import { WordPressWhy } from "@/components/marketing/integrations/wordpress/wordpress-why";
import { SnapPage } from "@/components/marketing/snap-page";

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
 * **It moves a screen at a time, like the landing page** (`SnapPage`): it does
 * the same job for one platform, so it reads the same way — the hero holds the
 * first screen with the header, every section after it is a `Section screen`,
 * and it ends on the questions beside the way in. Each of those is a height
 * budget (docs/notes/marketing.md); re-measure before adding a row.
 *
 * Statically rendered; reads no request input.
 */
export default function WordPressIntegrationPage() {
  return (
    <SnapPage>
      <WordPressHero />
      <WordPressSteps />
      <WordPressWhy />
      <WordPressOtherWays />
      <IntegrationClosing
        items={WORDPRESS_FAQ}
        title={
          <>
            Your map, on your WordPress page <span className="text-accent">today</span>.
          </>
        }
        lede="Start on the free plan, with the free plugin. Upgrade when your map outgrows it."
      />
    </SnapPage>
  );
}
