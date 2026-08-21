"use client";

import { Tabs } from "@heroui/react";
import { FileSpreadsheet, Sheet, type LucideIcon } from "lucide-react";
import { motion } from "motion/react";
import type { ReactNode } from "react";

import { stepMotion } from "@/components/ui/list-row-motion";

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
 * **The strip is capped at the dropzone's own width.** `max-w-2xl` is
 * `file-drop.tsx`'s cap, moved up here so that it applies to the tabs and to
 * both panels at once: a control that is wider than the frame it opens reads as
 * two unrelated elements stacked on each other rather than one thing.
 *
 * `gap-0` on the root undoes `.tabs`'s own flex gap so the space between the
 * strip and the panel is the panel's `mt-4` alone, which is the same 1rem the
 * surrounding `SectionPanel` body puts between everything else.
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
      className="mx-auto w-full max-w-2xl gap-0"
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
       * React Aria renders only the selected panel, so switching tabs is a real
       * unmount and mount — which is what makes the arrival animation fire. It
       * is an entrance only, with no matching exit: an `AnimatePresence` here
       * would need to hold the leaving panel in the tree, and the panel is the
       * one element in this subtree React Aria insists on owning.
       *
       * The two panels are 60px apart in height, so the swap is worth softening
       * even one-sided.
       */}
      {TABS.map((tab) => (
        <Tabs.Panel key={tab.id} id={tab.id} className="p-0">
          <motion.div {...stepMotion()}>{panels[tab.id]}</motion.div>
        </Tabs.Panel>
      ))}
    </Tabs>
  );
}
