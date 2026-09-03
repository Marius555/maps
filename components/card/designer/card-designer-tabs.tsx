"use client";

import { ScrollShadow, Tabs } from "@heroui/react";
import type { ReactNode } from "react";

import { SectionPanel } from "@/components/ui/section-panel";
import { useTabSwipe } from "./use-tab-swipe";

export type DesignerTab = "elements" | "modify";

/** What the panel calls itself, per tab. The strip and the heading agree. */
const TAB_TITLES: Record<DesignerTab, string> = {
  elements: "Blocks",
  modify: "Modify",
};

/**
 * The sidebar: two jobs — adding a block, adjusting one — and the panel around
 * them.
 *
 * They used to be two stacked panels, always both open. A tab reads better
 * once a block is selected: `CardDesigner` switches here automatically on a
 * click, so "I clicked Category and its width slider showed up" is a single
 * cause and effect instead of a scroll down to a properties panel that was
 * already there.
 *
 * **The panel is built here, and `Tabs` is on the outside of it.** That is the
 * one structural thing worth knowing. The strip belongs in the header — it is
 * chrome, and a body that scrolls would carry it off the top — while the panels
 * are the body itself; React Aria keeps the two in one context, so the context
 * has to enclose the `<section>` rather than sit inside it. Everything the panel
 * needs beyond that is passed straight through.
 *
 * **The heading names the open tab.** It used to read "Blocks" over a fixed
 * subtitle — "Drag one onto the card. Only the places it can go will light up."
 * — and both of them stayed there while the Modify tab showed a column of
 * sliders, so the panel was captioning a thing it was not displaying. The
 * subtitle is gone and the strip stands where it was: one line saying what this
 * is, and it is the tab you are on. That is also about 48px of chrome returned
 * to the controls, which is the reason it was worth doing.
 *
 * It fills the sidebar's *height*, and the panel body is what scrolls. Both
 * halves matter: the strip has to stay put, and the two tabs are different
 * heights, so a body that grew to its contents would make the sidebar grow —
 * and the sidebar's height is what used to move the card every time someone
 * switched tabs.
 *
 * All of it is `lg:`-gated, because below that the sidebar sits under the card
 * with no height of its own to scroll inside — there it is just a panel, as
 * tall as whichever tab is open, and the page scrolls.
 */
export function CardDesignerTabs({
  activeTab,
  onTabChange,
  action,
  footer,
  isDirty,
  elementsPanel,
  modifyPanel,
}: {
  activeTab: DesignerTab;
  onTabChange: (tab: DesignerTab) => void;
  /** Sits opposite the heading — the designer's Reset. */
  action?: ReactNode;
  /**
   * Below the body, outside the scroller — the designer's Save, on the Elements
   * tab only. See the note where `CardDesigner` decides that.
   */
  footer?: ReactNode;
  /**
   * Whether there is anything to save, for the mark on the Elements tab.
   *
   * The strip has to carry it because Save no longer sits on both tabs: with a
   * block selected the button is one click away, and a control you cannot see
   * is a control you have to remember. See `UnsavedDot`.
   */
  isDirty?: boolean;
  elementsPanel: ReactNode;
  modifyPanel: ReactNode;
}) {
  // Left and right between the two, on touch only — see `useTabSwipe`, which
  // owns every rule about when a finger movement is and is not this gesture.
  const swipeProps = useTabSwipe(activeTab, onTabChange);

  return (
    <Tabs
      // `gap-0` cancels HeroUI's own `.tabs` gap: the only child here is the
      // panel, which owns every edge inside it.
      className="flex w-full flex-col gap-0 lg:min-h-0"
      selectedKey={activeTab}
      onSelectionChange={(key) => onTabChange(key as DesignerTab)}
    >
      <SectionPanel
        title={TAB_TITLES[activeTab]}
        action={action}
        footer={footer}
        toolbar={
          <Tabs.ListContainer>
            <Tabs.List aria-label="Card designer">
              <Tabs.Tab id="elements">
                Elements
                {isDirty ? <UnsavedDot /> : null}
                <Tabs.Indicator />
              </Tabs.Tab>
              <Tabs.Tab id="modify">
                Modify
                <Tabs.Indicator />
              </Tabs.Tab>
            </Tabs.List>
          </Tabs.ListContainer>
        }
        // At `lg` the panel is a fixed-height column whose body scrolls, rather
        // than a box that grows with whichever tab is open — that is what keeps
        // the card still while the sidebar's contents change under it. Below
        // `lg` it is an ordinary panel and the page scrolls.
        className="flex flex-col lg:min-h-0 lg:flex-1 lg:overflow-hidden"
        bodyClassName="flex flex-col lg:min-h-0 lg:flex-1"
      >
        <DesignerTabPanel id="elements" swipeProps={swipeProps}>
          {elementsPanel}
        </DesignerTabPanel>
        <DesignerTabPanel id="modify" swipeProps={swipeProps}>
          {modifyPanel}
        </DesignerTabPanel>
      </SectionPanel>
    </Tabs>
  );
}

/**
 * There is something to save, and it is saved from the other tab.
 *
 * A dot rather than a count or a word: the sentence above the card already says
 * "You have unsaved changes", so this only has to point at *where* — and a tab
 * label is not somewhere a sentence fits. It carries `sr-only` text because a
 * 6px circle says nothing to a screen reader, and `aria-hidden` on the circle
 * itself so the two are not read as two things.
 *
 * `bg-accent` and not a warning colour: unsaved work is the normal state of a
 * designer, not a fault.
 */
function UnsavedDot() {
  return (
    <>
      <span
        aria-hidden="true"
        // `ms-1.5` rather than a `gap` on the tab: the tab's third child is
        // `Tabs.Indicator`, and a gap would push that off the label it
        // underlines. `size-2` because the dot sits beside 14px text — at 6px
        // it read as a rendering speck rather than as a mark.
        className="ms-1.5 size-2 shrink-0 rounded-full bg-accent"
      />
      <span className="sr-only">(unsaved changes)</span>
    </>
  );
}

/**
 * One tab's contents, and the sidebar's only scroller.
 *
 * **The bar is hidden and the scrolling is not**, which is `ScrollShadow
 * hideScrollBar` — the same control, for the same reason, as the card's own
 * middle zone (`CardZoneBox` in ../card-frame.tsx). A scrollbar down the side of
 * a panel whose whole job is arranging something visual is chrome competing with
 * the thing being arranged, and on a 24rem column it was taking width the
 * controls were already short of.
 *
 * `scrollbar-gutter: stable` went with it, and that is the width actually
 * returned. It existed because the Elements tab is short enough not to scroll
 * while the Modify tab always does, so switching tabs took ~15px out of the
 * content and re-wrapped every control; reserving the gutter paid that cost
 * permanently to stop it jumping. With no bar to reserve for, both problems are
 * the same nothing.
 *
 * **The fade stays** rather than being turned off with `size={0}`. Once the bar
 * is gone it is the only thing telling anyone the panel continues past the fold
 * — exactly the argument the card's middle zone already makes.
 *
 * `min-h-0` is what lets `overflow-y-auto` mean anything: a flex item refuses to
 * shrink below its content without it, so the panel would push the sidebar
 * taller instead of scrolling inside it. It is needed on both boxes now — the
 * panel is a flex item of the section, and the shadow is a flex item of the
 * panel.
 *
 * `overflow-x-hidden` is not decoration. CSS computes an axis left at `visible`
 * to `auto` the moment its partner is `auto`, so `overflow-y-auto` alone gave
 * this box a real horizontal scrollbar off any stray pixel — and the Modify tab
 * has one, in the `whitespace-nowrap` segmented row that names the block above
 * and below.
 *
 * `mt-0` cancels HeroUI's `.tabs__panel` margin, which assumed the strip was
 * directly above it. It is in the header now, one rule up.
 */
function DesignerTabPanel({
  id,
  swipeProps,
  children,
}: {
  id: DesignerTab;
  /**
   * The swipe gesture, on the panel rather than on the strip: the strip is two
   * small targets at the top of the screen and the panel is the whole of the
   * rest, which is where a thumb actually is. Both panels get the same handlers
   * — only the mounted one can be touched.
   */
  swipeProps: ReturnType<typeof useTabSwipe>;
  children: ReactNode;
}) {
  return (
    <Tabs.Panel
      id={id}
      className="mt-0 flex flex-col p-0 lg:min-h-0 lg:flex-1 lg:overflow-hidden"
    >
      <ScrollShadow
        hideScrollBar
        size={24}
        className="lg:min-h-0 lg:flex-1 lg:overflow-x-hidden lg:overflow-y-auto"
        {...swipeProps}
      >
        {children}
      </ScrollShadow>
    </Tabs.Panel>
  );
}
