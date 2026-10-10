import type { Metadata } from "next";

import { AnyWebsiteCode } from "@/components/marketing/integrations/any-website/any-website-code";
import { AnyWebsiteHero } from "@/components/marketing/integrations/any-website/any-website-hero";
import { IntegrationCta } from "@/components/marketing/integrations/integration-cta";

const DESCRIPTION =
  "Put a map of your locations on any website with one line of code — Webflow, Shopify, plain HTML or any builder with an HTML block.";

export const metadata: Metadata = {
  title: "Maps for any website",
  description: DESCRIPTION,
  openGraph: {
    title: "Maps for any website",
    description: DESCRIPTION,
    type: "website",
  },
};

/**
 * The snippet's page in the Integrations menu, for every builder without a
 * plugin of its own. Deliberately short — the drawing, the code with a copy
 * button, the way in — because the guide (/docs/publishing-and-embedding)
 * already carries the detail.
 */
export default function AnyWebsiteIntegrationPage() {
  return (
    <>
      <AnyWebsiteHero />
      <AnyWebsiteCode />
      <IntegrationCta
        title={
          <>
            Your map, on your site <span className="text-accent">today</span>.
          </>
        }
        lede="Start on the free plan. Upgrade when your map outgrows it."
      />
    </>
  );
}
