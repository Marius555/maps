import { Section } from "@/components/marketing/section";
import { LinkButton } from "@/components/ui/link-button";

import { FaqAccordion, type FaqItem } from "./faq-accordion";

/**
 * The last screen of a platform page: the questions, and beside them the way
 * in — the page's ask, the way the landing page ends on the survey's two
 * buttons rather than on a banner of its own.
 *
 * **One screen, so it is a budget** (docs/notes/marketing.md). The questions
 * run `dense`, which also holds their column at its tallest — every question
 * shut plus the longest answer open (`FaqAccordion`) — so an answer opening
 * cannot move the title above it.
 */
export function IntegrationClosing({
  items,
  title,
  lede,
  actions,
}: {
  items: readonly FaqItem[];
  title: React.ReactNode;
  lede: string;
  /** The buttons; "Create a free map" and "See pricing" when left out. */
  actions?: React.ReactNode;
}) {
  return (
    <Section
      screen
      eyebrow="Questions"
      title={
        <>
          Frequently asked <span className="text-accent">questions</span>
        </>
      }
    >
      <div className="grid items-start gap-8 lg:grid-cols-[1.55fr_1fr] lg:gap-12">
        <FaqAccordion items={items} dense />

        <aside className="mk-outline flex flex-col items-start gap-4 rounded-3xl p-7 sm:p-8">
          <h2 className="mk-display text-3xl text-balance text-foreground">{title}</h2>
          <p className="text-sm/6 text-pretty text-muted">{lede}</p>
          <div className="mt-2 flex flex-wrap gap-3">
            {actions ?? (
              <>
                <LinkButton href="/signup">Create a free map</LinkButton>
                <LinkButton href="/pricing" variant="tertiary">
                  See pricing
                </LinkButton>
              </>
            )}
          </div>
        </aside>
      </div>
    </Section>
  );
}
