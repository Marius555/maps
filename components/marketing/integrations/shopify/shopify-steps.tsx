import { Reveal } from "@/components/marketing/reveal";
import { Section } from "@/components/marketing/section";
import { StepPanel } from "@/components/marketing/steps/step-panel";

import { AddToThemeArt, ImportLocationsArt, InstallAppArt } from "./art/shopify-art-loader";

/**
 * The three steps, a drawing and one line each, told the way the landing page
 * and /for/wordpress tell theirs. Every label quoted is one the app or Shopify
 * draws (docs/notes/shopify.md): Import from Shopify, Show on your storefront,
 * Add to theme. Each drawing plays while its panel is hovered.
 */
const STEPS = [
  {
    title: "Install the app",
    subtitle: "From the Shopify App Store. It opens in your admin — no separate account.",
    art: <InstallAppArt />,
  },
  {
    title: "Bring in your locations",
    subtitle: "Press Import from Shopify, or drop in a spreadsheet.",
    art: <ImportLocationsArt />,
  },
  {
    title: "Add it to your theme",
    subtitle: "Show on your storefront, then Add to theme — the block is in.",
    art: <AddToThemeArt />,
  },
];

export function ShopifySteps() {
  return (
    <Section
      screen
      eyebrow="Setup"
      title={
        <>
          On your store in <span className="text-accent">three steps</span>
        </>
      }
    >
      <ol className="grid gap-5 md:grid-cols-3">
        {STEPS.map((step, index) => (
          <li key={step.title}>
            <Reveal delay={index * 0.06} className="h-full">
              <StepPanel title={step.title} subtitle={step.subtitle} art={step.art} />
            </Reveal>
          </li>
        ))}
      </ol>
    </Section>
  );
}
