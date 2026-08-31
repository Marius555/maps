"use client";

import { Tabs } from "@heroui/react";
import type { ReactNode } from "react";

export type DesignerTab = "elements" | "modify";

/**
 * Where the sidebar's two jobs — adding a block, adjusting one — live now.
 *
 * They used to be two stacked panels, always both open. A tab reads better
 * once a block is selected: `CardDesigner` switches here automatically on a
 * click, so "I clicked Category and its width slider showed up" is a single
 * cause and effect instead of a scroll down to a properties panel that was
 * already there.
 *
 * Full width and uncapped, unlike `source-tabs.tsx`'s own use of this same
 * `Tabs` primitive — that one centers a strip over a fixed-width dropzone,
 * this one fills the sidebar column it lives in.
 *
 * It fills that column's *height* too, and the panel is what scrolls. Both
 * halves matter: the strip has to stay put, and the two tabs are different
 * heights, so a panel that grew to its contents would make the sidebar grow —
 * and the sidebar's height is what used to move the card every time someone
 * switched tabs. HeroUI's `.tabs` is already `flex-col` at horizontal
 * orientation, so the panel is a flex sibling of the strip and `flex-1` on it
 * is all this takes.
 *
 * All of it is `lg:`-gated, because below that the sidebar sits under the card
 * with no height of its own to scroll inside — there it is just a panel, as
 * tall as whichever tab is open, and the page scrolls.
 */
export function CardDesignerTabs({
  activeTab,
  onTabChange,
  elementsPanel,
  modifyPanel,
}: {
  activeTab: DesignerTab;
  onTabChange: (tab: DesignerTab) => void;
  elementsPanel: ReactNode;
  modifyPanel: ReactNode;
}) {
  return (
    <Tabs
      className="flex w-full flex-col gap-0 lg:min-h-0 lg:flex-1"
      selectedKey={activeTab}
      onSelectionChange={(key) => onTabChange(key as DesignerTab)}
    >
      <Tabs.ListContainer>
        <Tabs.List aria-label="Card designer">
          <Tabs.Tab id="elements">
            Elements
            <Tabs.Indicator />
          </Tabs.Tab>
          <Tabs.Tab id="modify">
            Modify
            <Tabs.Indicator />
          </Tabs.Tab>
        </Tabs.List>
      </Tabs.ListContainer>

      {/* `min-h-0` is what lets `overflow-y-auto` mean anything here: a flex
          item refuses to shrink below its content without it, so the panel
          would push the sidebar taller instead of scrolling inside it. */}
      <Tabs.Panel id="elements" className="p-0 pt-4 lg:min-h-0 lg:flex-1 lg:overflow-y-auto">
        {elementsPanel}
      </Tabs.Panel>
      <Tabs.Panel id="modify" className="p-0 pt-4 lg:min-h-0 lg:flex-1 lg:overflow-y-auto">
        {modifyPanel}
      </Tabs.Panel>
    </Tabs>
  );
}
