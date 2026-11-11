import { Section } from "@/components/marketing/section";

import { FaqAccordion, type FaqItem } from "./faq-accordion";

export type { FaqItem };

/**
 * A platform page's questions as a section of their own, for a page that
 * scrolls as a document (/for/any-website). A page that moves a screen at a
 * time closes on `IntegrationClosing` instead, which puts them beside the way in.
 */
export function IntegrationFaq({ items }: { items: readonly FaqItem[] }) {
  return (
    <Section
      eyebrow="Questions"
      title={
        <>
          Frequently asked <span className="text-accent">questions</span>
        </>
      }
    >
      <FaqAccordion items={items} />
    </Section>
  );
}
