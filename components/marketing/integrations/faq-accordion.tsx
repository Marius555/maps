"use client";

import { Accordion } from "@heroui/react";
import { ChevronDown } from "lucide-react";
import { useLayoutEffect, useRef, useState } from "react";

export type FaqItem = { question: string; answer: React.ReactNode };

/**
 * A platform page's questions, folded. One open at a time and none to begin
 * with — react-aria's `DisclosureGroup` default, and the rule every fold in the
 * app already follows (CLAUDE.md §8).
 *
 * The answers are in the served HTML either way: a closed panel is hidden, not
 * absent, so a search engine and a reader without JavaScript still get them.
 *
 * `dense` is the closing screen's measure (`IntegrationClosing`): tighter rows,
 * so nine questions and the tallest answer fit one screen beside the way in.
 *
 * **`dense` also holds the list at its tallest**, from `lg`, where the page
 * snaps. The closing screen centres its content like every `screen` section,
 * so an answer opening would move the title above it by half the answer's
 * height. The floor is every question shut plus the longest answer open, read
 * off the page — the questions' own rows, and the answers laid out once,
 * invisibly, at the list's width — and read again when the width changes,
 * because that is what rewraps them. It is a measurement rather than a number
 * because each platform's answers are different and every one rewraps per width.
 */
export function FaqAccordion({
  items,
  dense = false,
  className = "",
}: {
  items: readonly FaqItem[];
  dense?: boolean;
  className?: string;
}) {
  const list = useRef<HTMLDivElement>(null);
  const sizers = useRef<HTMLDivElement>(null);
  const [reserve, setReserve] = useState<number>();

  useLayoutEffect(() => {
    const root = list.current;
    if (!dense || !root) return;

    const measure = () => {
      const rows = [...root.querySelectorAll("[data-faq-question]")].reduce(
        (sum, el) => sum + el.getBoundingClientRect().height,
        0,
      );
      const answers = [...(sizers.current?.children ?? [])].map(
        (el) => el.getBoundingClientRect().height,
      );
      // The list's top and bottom hairlines.
      setReserve(Math.ceil(rows + Math.max(0, ...answers) + 2));
    };

    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(root);
    return () => observer.disconnect();
  }, [dense, items]);

  const bodyClass = `text-sm/6 text-pretty text-muted [&_a]:text-foreground [&_a]:underline [&_a]:underline-offset-2 ${dense ? "pb-4" : "pb-5"}`;

  return (
    <div
      ref={list}
      className={`relative ${dense ? "lg:min-h-[var(--mk-faq-reserve)]" : ""} ${className}`}
      style={reserve ? ({ "--mk-faq-reserve": `${reserve}px` } as React.CSSProperties) : undefined}
    >
      <Accordion className="border-y border-border">
        {items.map((item, index) => (
          <Accordion.Item key={item.question} id={`faq-${index}`}>
            <Accordion.Heading data-faq-question="">
              <Accordion.Trigger
                className={`text-left font-medium text-foreground ${dense ? "py-2.5 text-sm" : "py-4 text-base"}`}
              >
                {item.question}
                <Accordion.Indicator>
                  <ChevronDown aria-hidden="true" className="size-4" />
                </Accordion.Indicator>
              </Accordion.Trigger>
            </Accordion.Heading>
            <Accordion.Panel>
              <Accordion.Body className={bodyClass}>{item.answer}</Accordion.Body>
            </Accordion.Panel>
          </Accordion.Item>
        ))}
      </Accordion>

      {/* Every answer, laid out at the list's width and never shown: what the reserve is read from. */}
      {dense ? (
        <div ref={sizers} aria-hidden="true" className="invisible absolute inset-x-0 top-0 -z-10">
          {items.map((item) => (
            <div key={item.question} className={bodyClass}>
              {item.answer}
            </div>
          ))}
        </div>
      ) : null}
    </div>
  );
}
