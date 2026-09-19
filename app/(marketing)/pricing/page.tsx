import type { Metadata } from "next";

import { Plans } from "@/components/marketing/plans/plans";

const DESCRIPTION =
  "Free, Starter and Pro — priced by the maps and locations you build, never by how many people look at them. Unlimited map views on every plan.";

export const metadata: Metadata = {
  title: "Pricing",
  description: DESCRIPTION,
  openGraph: {
    title: "Pricing",
    description: DESCRIPTION,
    type: "website",
  },
};

/**
 * The plans, on a page of their own.
 *
 * One section and nothing around it: the landing page's calculator is where
 * the argument is made, and this is where somebody who has been convinced comes
 * to pick. Statically rendered, like the rest of the public site.
 */
export default function PricingPage() {
  return <Plans />;
}
