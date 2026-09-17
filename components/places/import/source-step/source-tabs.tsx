"use client";

import { Tabs } from "@heroui/react";
import { FileSpreadsheet, Sheet, type LucideIcon } from "lucide-react";
import type { ReactNode } from "react";

export type SourceTab = "file" | "google-sheet";

const TABS: readonly { id: SourceTab; label: string; icon: LucideIcon }[] = [
  { id: "file", label: "Upload a file", icon: FileSpreadsheet },
  { id: "google-sheet", label: "Google Sheet", icon: Sheet },
];

/**
 * Two ways in.
 *
 * This was a pair of hand-rolled radio buttons in a two-up grid, on the
 * reasoning that only one of them is ever filled in so the semantics are "pick
 * one" rather than "switch view". That was the wrong read: nothing is being
 * chosen here that survives the step — picking a tab commits to nothing, and
 * the thing it actually does is show a different panel. A tab widget says that,
 * and brings arrow-key navigation and the panel's `aria-labelledby` with it.
 *
 * **No width of its own.** The wizard caps the Source step, and the strip and
 * both panels fill it, so the tabs, the frame they open and the step trail
 * above are one column by construction.
 *
 * `gap-0` on the root undoes `.tabs`'s own flex gap so the space between the
 * strip and the panel is the stack's `mt-4` alone.
 *
 * The panels are handed in rather than rendered here so the step above keeps
 * ownership of what they do, and this file keeps ownership of the ARIA wiring.
 */
export function SourceTabs({
  current,
  onChange,
  filePanel,
  sheetPanel,
}: {
  current: SourceTab;
  onChange: (tab: SourceTab) => void;
  filePanel: ReactNode;
  sheetPanel: ReactNode;
}) {
  const panels: Record<SourceTab, ReactNode> = {
    file: filePanel,
    "google-sheet": sheetPanel,
  };

  return (
    <Tabs
      className="w-full gap-0"
      selectedKey={current}
      onSelectionChange={(key) => onChange(key as SourceTab)}
    >
      <Tabs.ListContainer>
        <Tabs.List aria-label="Where your locations come from">
          {TABS.map((tab) => (
            <Tabs.Tab key={tab.id} id={tab.id} className="gap-2">
              <tab.icon aria-hidden="true" className="size-4 shrink-0" />
              {tab.label}
              <Tabs.Indicator />
            </Tabs.Tab>
          ))}
        </Tabs.List>
      </Tabs.ListContainer>

      {/*
       * **Both panels are always mounted, stacked in one grid cell, so switching
       * tabs cannot change the height of anything.**
       *
       * React Aria renders only the selected panel by default, and the two
       * differ by about 60px. The step is centred down the page with `my-auto`,
       * so each switch moved the strip, the step trail and everything else by
       * half of that. Stacking both in `grid-area: 1/1` makes the cell as tall as
       * the taller panel at every width, with nothing measured and no number to
       * keep in step with the content.
       *
       * `shouldForceMount` is what keeps the unselected panel in the tree;
       * React Aria then marks it `inert` (out of focus order and the
       * accessibility tree) and `data-inert="true"`, which is what hides it.
       * `invisible` rather than `hidden`, because a `display: none` panel
       * contributes no height and the stack would be back to one panel's worth.
       *
       * **The swap is instant, and it has to be.** A fade was tried: React Aria
       * sees the transition on the panel being left, marks it `data-exiting`
       * for the length of it, and HeroUI's stylesheet makes an exiting panel
       * `position: absolute` — which takes it out of the stack. Measured, the
       * cell dropped from 198px to 184px and the strip jumped 7px on every
       * switch, the exact shift this exists to remove. `data-[exiting]:static`
       * stays as a guard in case anything ever animates a panel again.
       *
       * `mt-0` on the panels because HeroUI gives a horizontal `.tabs__panel`
       * its own `mt-4`, and in a stack that margin belongs to the stack.
       */}
      <div className="mt-4 grid">
        {TABS.map((tab) => (
          <Tabs.Panel
            key={tab.id}
            id={tab.id}
            shouldForceMount
            className="mt-0 p-0 [grid-area:1/1] data-[exiting=true]:static data-[inert=true]:invisible"
          >
            {panels[tab.id]}
          </Tabs.Panel>
        ))}
      </div>
    </Tabs>
  );
}
