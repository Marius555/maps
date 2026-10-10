import Link from "next/link";

import { Reveal } from "@/components/marketing/reveal";
import { Section } from "@/components/marketing/section";
import { StepPanel } from "@/components/marketing/steps/step-panel";

import { HtmlBlockArt } from "./art/html-block-art";
import { ShortcodeArt } from "./art/shortcode-art";

/**
 * The two cases the block does not cover: an editor without blocks, and a site
 * that would rather not install anything. Both are in the plugin's readme and
 * the guide; this shows them and links to the detail.
 */
export function WordPressOtherWays() {
  return (
    <Section
      eyebrow="Other editors"
      title={
        <>
          Not using the <span className="text-accent">block editor</span>?
        </>
      }
    >
      <div className="grid gap-5 md:grid-cols-2">
        <Reveal className="h-full">
          <StepPanel
            title="Classic editor or a page builder"
            subtitle="Settings → Pinglide → Connect a new map, then paste the shortcode."
            art={<ShortcodeArt />}
          />
        </Reveal>
        <Reveal className="h-full" delay={0.06}>
          <StepPanel
            title="No plugin at all"
            subtitle="Paste your map’s embed code into a Custom HTML block."
            art={<HtmlBlockArt />}
          />
        </Reveal>
      </div>

      <p className="mt-6 text-sm text-muted">
        Elementor, Divi and Beaver Builder all take the shortcode.{" "}
        <Link
          href="/docs/publishing-and-embedding#embed-code"
          className="text-foreground underline underline-offset-2"
        >
          How embedding works
        </Link>
      </p>
    </Section>
  );
}
