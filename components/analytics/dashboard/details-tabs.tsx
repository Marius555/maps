"use client";

import { Card, Chip, Tabs } from "@heroui/react";
import { useState, type ReactNode } from "react";

import { formatCount } from "@/lib/format/number";
import { DETAIL_TABS, type DetailTab } from "../sections";

export type DetailEntry = {
  id: DetailTab;
  /** The table's row count, on the tab. */
  count: number;
  /** Colours the count: the one table that names something to fix. */
  warn?: boolean;
  panel: ReactNode;
};

/**
 * The page's tables, as tabs in one card.
 *
 * **Only the tables are tabbed.** The figures, charts and heat map above are
 * always on screen — the page used to put everything behind five tabs, which
 * hid the heat map a click away and made a tab of the one table worth acting
 * on. Tables are the part a reader goes looking in, one at a time, so that is
 * where switching belongs.
 *
 * **Only the tabs that have rows are handed in** — `detail-tabs.ts` decides,
 * from the data, before this renders.
 *
 * **The tab is in the URL**, as `?tab=`, so a pasted link or a reload lands on
 * the table that was being read. Written with `history.replaceState` rather
 * than a navigation because every panel is already here, rendered by the
 * server; replace rather than push, so Back leaves the page rather than walking
 * back through tab clicks. React Aria mounts the selected panel alone.
 */
export function DetailsTabs({
  initial,
  tabs,
}: {
  initial: DetailTab | null;
  tabs: DetailEntry[];
}) {
  const first = tabs[0]?.id;
  const [selected, setSelected] = useState<DetailTab | undefined>(
    tabs.some((tab) => tab.id === initial) ? (initial ?? first) : first,
  );

  if (!selected) return null;

  function select(tab: DetailTab) {
    setSelected(tab);

    const url = new URL(window.location.href);
    if (tab === first) url.searchParams.delete("tab");
    else url.searchParams.set("tab", tab);
    window.history.replaceState(window.history.state, "", url);
  }

  return (
    <Card className="min-w-0 gap-0 p-4 sm:p-5">
      <h2 className="sr-only">Details</h2>

      <Tabs
        className="w-full gap-0"
        selectedKey={selected}
        onSelectionChange={(key) => {
          select(key as DetailTab);
        }}
      >
        {/* Scrolls sideways on a phone rather than wrapping: six tabs at
            390px do not fit, and a second row of tabs reads as a second
            control. */}
        <div className="-mx-4 overflow-x-auto px-4 sm:-mx-5 sm:px-5">
          <Tabs.ListContainer className="w-max">
            <Tabs.List aria-label="Tables">
              {tabs.map((tab) => (
                <Tabs.Tab key={tab.id} id={tab.id} className="min-w-0 gap-2 px-3">
                  {DETAIL_TABS[tab.id]}
                  <Chip
                    size="sm"
                    variant="soft"
                    color={tab.warn ? "warning" : "default"}
                    className="tabular-nums"
                  >
                    {formatCount(tab.count)}
                  </Chip>
                  <Tabs.Indicator />
                </Tabs.Tab>
              ))}
            </Tabs.List>
          </Tabs.ListContainer>
        </div>

        {tabs.map((tab) => (
          <Tabs.Panel key={tab.id} id={tab.id} className="mt-4 p-0">
            {tab.panel}
          </Tabs.Panel>
        ))}
      </Tabs>
    </Card>
  );
}
