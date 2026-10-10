"use client";

import { Accordion } from "@heroui/react";
import { ChevronDown } from "lucide-react";

import { Section } from "@/components/marketing/section";

export type FaqItem = { question: string; answer: React.ReactNode };

/**
 * A platform page's questions, folded. One open at a time and none to begin
 * with — react-aria's `DisclosureGroup` default, and the rule every fold in the
 * app already follows (CLAUDE.md §8).
 *
 * The answers are in the served HTML either way: a closed panel is hidden, not
 * absent, so a search engine and a reader without JavaScript still get them.
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
      <Accordion className="border-y border-border">
        {items.map((item, index) => (
          <Accordion.Item key={item.question} id={`faq-${index}`}>
            <Accordion.Heading>
              <Accordion.Trigger className="py-4 text-left text-base font-medium text-foreground">
                {item.question}
                <Accordion.Indicator>
                  <ChevronDown aria-hidden="true" className="size-4" />
                </Accordion.Indicator>
              </Accordion.Trigger>
            </Accordion.Heading>
            <Accordion.Panel>
              <Accordion.Body className="pb-5 text-sm/6 text-pretty text-muted [&_a]:text-foreground [&_a]:underline [&_a]:underline-offset-2">
                {item.answer}
              </Accordion.Body>
            </Accordion.Panel>
          </Accordion.Item>
        ))}
      </Accordion>
    </Section>
  );
}
