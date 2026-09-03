"use client";

import type { ReactNode } from "react";

/**
 * One named run of controls in the Modify tab.
 *
 * The panel used to be a flat column of thirteen controls in one `space-y-4` —
 * a width slider, an overlap, a font, a chip colour and a week's row spacing all
 * at one rhythm with nothing between them saying which question each answered.
 * The complaint it draws is precise and worth recording: *some of these change
 * the field's box and some change what is inside it*, and a flat list cannot say
 * which is which. So the controls are grouped by the question they answer —
 * where the block goes, how much room it has, what it says, what its words look
 * like, what its chips look like — and the headings are what make that legible.
 *
 * **Always open, never a `Disclosure`.** The panel is a fixed-height column that
 * already scrolls (`DesignerTabPanel` in ../card-designer-tabs.tsx), so folding
 * buys height that was never scarce and costs a click on the way to every
 * control. Grouping is the fix; hiding is not.
 *
 * **A group with nothing in it renders nothing at all**, heading included. Every
 * control here is behind a `hasControl` check and several are behind a second
 * condition on top of that (`narrow`, `aloneOnLine`, whether there is a border
 * colour yet), so a spacer's panel would otherwise be five headings over one
 * slider. That is why `isEmpty` is a prop rather than something worked out from
 * `children`: React counts a `false` as a child, so a group whose every control
 * is conditional still looks populated from in here.
 */
export function PropertyGroup({
  title,
  isEmpty,
  children,
}: {
  title: string;
  /** Whether every control in this group is currently hidden. */
  isEmpty?: boolean;
  children: ReactNode;
}) {
  if (isEmpty) return null;

  return (
    /* `space-y-3` inside a group against the `space-y-5` between them: the gap
       that separates two questions has to be visibly larger than the gap
       between two controls answering one, or the headings are the only thing
       doing the grouping and they are 11px tall. */
    <section className="space-y-3">
      {/* Uppercase and muted — a heading for a run of controls, not a title
          competing with the block's own name at the top of the panel. */}
      <h4 className="text-[11px] font-semibold tracking-wide text-muted uppercase">
        {title}
      </h4>
      {children}
    </section>
  );
}

/**
 * The groups themselves, and the rule between them.
 *
 * A hairline plus the wider gap, rather than either alone: the panel is a narrow
 * column of pale controls on a pale surface, and space on its own reads as an
 * accident at this width. `divide-y` rather than a border on each group, so the
 * first has no rule above it and the last none below — and `[&>*]:pt-5` because
 * `divide-y` only draws the line, it does not make room around it.
 */
export function PropertyGroups({ children }: { children: ReactNode }) {
  return (
    <div className="divide-y divide-border [&>*+*]:pt-5">{children}</div>
  );
}
