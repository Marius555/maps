"use client";

import { Accordion } from "@heroui/react";
import { ChevronDown } from "lucide-react";
import type { ReactNode } from "react";

/**
 * One named, foldable run of controls inside an `Accordion`.
 *
 * A `Disclosure` needs its `Trigger` inside a `Heading` and its `Body` inside a
 * `Panel`, and an `Accordion` is the same anatomy with the open/closed state
 * lifted to the group. Getting it wrong renders a trigger with no accessible
 * heading and no animation — which is why this is one component rather than a
 * shape copied out by hand at each call site.
 *
 * **It replaced an always-open `PropertyGroup`, and that reversal is worth
 * recording.** The argument for always-open was that the card designer's Modify
 * panel is a fixed-height column that already scrolls, so folding buys height
 * that was never scarce and costs a click on the way to every control. What it
 * did not weigh is how much there is: a block offers up to seven headings and
 * around twenty controls at 24rem, and a column that long is one nobody reads
 * down — which is the same conclusion the publish designer's four questions and
 * the palette's four shelves had already reached separately. Three panels
 * agreeing is what settled it. Grouping was the fix; grouping *and* folding is
 * the fix at this length.
 *
 * The caller owns the `Accordion` itself, because whether several folds may be
 * open at once, and which start open, are questions about the set rather than
 * about any one of them.
 *
 * **A fold with nothing in it renders nothing at all**, heading included. That
 * rule came from `PropertyGroup`, which this replaced in the card designer, and
 * it is worth repeating why it is a prop rather than something worked out from
 * `children`: React counts a `false` as a child, so a fold whose every control
 * is conditional still looks populated from in here. A block panel is mostly
 * conditional controls — a spacer's would otherwise be six headings over one
 * select, and folded that is six triggers that open onto nothing.
 */
export function PropertyFold({
  id,
  title,
  isEmpty,
  children,
}: {
  id: string;
  title: string;
  /** Whether every control in this fold is currently hidden. */
  isEmpty?: boolean;
  children: ReactNode;
}) {
  if (isEmpty) return null;

  return (
    <Accordion.Item id={id}>
      <Accordion.Heading>
        <Accordion.Trigger className="py-2.5 text-sm font-medium">
          {title}
          <Accordion.Indicator>
            <ChevronDown aria-hidden="true" className="size-4" />
          </Accordion.Indicator>
        </Accordion.Trigger>
      </Accordion.Heading>
      <Accordion.Panel>
        <Accordion.Body className="pb-4">{children}</Accordion.Body>
      </Accordion.Panel>
    </Accordion.Item>
  );
}
