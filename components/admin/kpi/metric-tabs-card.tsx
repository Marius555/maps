"use client";

import { Card, Tabs } from "@heroui/react";
import { useState } from "react";

import { TrendChip } from "@/components/analytics/dashboard/trend-chip";
import type { DataSource } from "@/lib/admin/source";
import type { Delta } from "@/lib/analytics/view";
import { MetricPanel, isEmptyChart, type MetricChart } from "./metric-panel";
import { SourceMark } from "./source-badge";

export type { MetricChart } from "./metric-panel";

export type MetricTab = {
  id: string;
  label: string;
  /** Already formatted — a count, or a count with its share. */
  value: string;
  delta?: Delta;
  /** The figure's own colour: the bar over its tab, and its line. */
  color: string;
  source: DataSource;
  chart: MetricChart;
};

/**
 * The period's figures and their daily charts, as one card.
 *
 * **Each tab is a figure** — its name, its total and how it moved — and picking
 * one draws that figure day by day below. The tabs switch the *metric*, never
 * a section.
 *
 * - **Tabs are as wide as their content.** HeroUI's tabs are `w-full`, so two
 *   tabs each took half the card and the underline ran half its width. Here a
 *   tab is `w-auto` and the selected one wears a short bar across its own top
 *   in the figure's colour, plus a raised background.
 * - **Every panel has the same geometry** — one header row, one chart box of
 *   fixed height — so switching tabs never moves the card. The explanation that
 *   used to wrap under the chart lives in the source badge's tooltip.
 * - **A figure with nothing in the period is not a tab**, and a card with no
 *   figures left is not drawn.
 */
export function MetricTabsCard({ label, tabs }: { label: string; tabs: MetricTab[] }) {
  const visible = tabs.filter((tab) => !isEmptyChart(tab.chart));
  const [chosen, setChosen] = useState(visible[0]?.id);
  const selected = visible.some((tab) => tab.id === chosen) ? chosen : visible[0]?.id;

  if (!selected) return null;

  return (
    <Card className="min-w-0 gap-0 overflow-hidden p-0">
      <Tabs
        variant="secondary"
        className="w-full gap-0"
        selectedKey={selected}
        onSelectionChange={(key) => setChosen(String(key))}
      >
        <Tabs.ListContainer>
          <Tabs.List aria-label={label} className="w-max min-w-full justify-start">
            {visible.map((tab) => (
              <Tabs.Tab
                key={tab.id}
                id={tab.id}
                className="group h-auto w-auto flex-none flex-col items-start justify-start gap-1 px-4 py-3.5 text-left data-[selected=true]:bg-surface-secondary sm:px-5"
              >
                <span
                  aria-hidden="true"
                  className="absolute inset-x-0 top-0 h-0.5 opacity-0 transition-opacity group-data-[selected=true]:opacity-100 motion-reduce:transition-none"
                  style={{ background: tab.color }}
                />
                <span className="flex items-center gap-1.5 text-xs font-medium whitespace-nowrap">
                  {tab.label}
                  <SourceMark kind={tab.source.kind} />
                </span>
                <span className="flex items-center gap-2 whitespace-nowrap">
                  <span className="text-xl font-semibold tracking-tight text-foreground sm:text-2xl">
                    {tab.value}
                  </span>
                  {tab.delta ? <TrendChip delta={tab.delta} /> : null}
                </span>
              </Tabs.Tab>
            ))}
          </Tabs.List>
        </Tabs.ListContainer>

        {visible.map((tab) => (
          <Tabs.Panel key={tab.id} id={tab.id} className="mt-0 p-4 sm:p-5">
            <MetricPanel label={tab.label} color={tab.color} source={tab.source} chart={tab.chart} />
          </Tabs.Panel>
        ))}
      </Tabs>
    </Card>
  );
}
