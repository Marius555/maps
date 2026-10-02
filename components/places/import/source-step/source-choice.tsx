"use client";

import { Radio, RadioGroup } from "@heroui/react";
import { FileSpreadsheet, Sheet, type LucideIcon } from "lucide-react";
import type { ReactNode } from "react";

export type SourceTab = "file" | "google-sheet";

const SOURCES: readonly {
  id: SourceTab;
  label: string;
  description: string;
  icon: LucideIcon;
}[] = [
  {
    id: "file",
    label: "Upload a file",
    description: "CSV, Excel or XML",
    icon: FileSpreadsheet,
  },
  {
    id: "google-sheet",
    label: "Google Sheet",
    description: "Paste a share link",
    icon: Sheet,
  },
];

/**
 * Two ways in, as two cards.
 *
 * A HeroUI `RadioGroup`, the pattern `appearance-picker.tsx` uses: arrow keys
 * move between the two and a screen reader hears one question with two answers.
 * Picking one commits to nothing — it only decides which panel shows below.
 *
 * Neutral on purpose: every card keeps the page's light `border`, and the
 * selected one is told by a white fill and a soft shadow plus the radio dot. A
 * darker border was tried and read as black on the grey page. Nothing about the
 * selection changes a size, so picking a card moves nothing.
 *
 * The panels are handed in rather than rendered here so the step above keeps
 * ownership of what they do.
 */
export function SourceChoice({
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
    <div className="space-y-4">
      <RadioGroup
        aria-label="Where your locations come from"
        orientation="horizontal"
        value={current}
        onChange={(value) => onChange(value as SourceTab)}
        className="grid grid-cols-1 gap-3 sm:grid-cols-2"
      >
        {SOURCES.map((source) => (
          <Radio key={source.id} value={source.id} className="group w-full min-w-0">
            <Radio.Content className="flex w-full min-w-0 items-center gap-3 rounded-xl border border-border px-4 py-3 transition-[background-color,box-shadow] duration-[var(--duration-fast)] group-data-[hovered=true]:bg-surface/60 group-data-[selected=true]:bg-surface group-data-[selected=true]:shadow-sm group-data-[focus-visible=true]:outline-2 group-data-[focus-visible=true]:outline-offset-2 group-data-[focus-visible=true]:outline-focus">
              <span
                aria-hidden="true"
                className="grid size-9 shrink-0 place-items-center rounded-lg bg-default text-foreground"
              >
                <source.icon className="size-4" />
              </span>

              <span className="min-w-0 flex-1">
                <span className="block truncate text-sm font-medium text-foreground">
                  {source.label}
                </span>
                <span className="block truncate text-xs text-muted">
                  {source.description}
                </span>
              </span>

              <Radio.Control>
                <Radio.Indicator />
              </Radio.Control>
            </Radio.Content>
          </Radio>
        ))}
      </RadioGroup>

      {/*
       * **Both panels are always mounted, stacked in one grid cell, so switching
       * source cannot change the height of anything.**
       *
       * The two panels differ in height and the step is centred down the page
       * with `my-auto`, so swapping one for the other moved the cards, the step
       * trail and everything else by half the difference. Stacking both in
       * `grid-area: 1/1` makes the cell as tall as the taller panel at every
       * width, with nothing measured.
       *
       * The unselected panel is `inert` (out of focus order and the
       * accessibility tree) and `invisible`, never `hidden`: a `display: none`
       * panel contributes no height. No transition here — see the notes on the
       * tabs this replaced in docs/notes/editor-and-layout.md.
       */}
      <div className="grid">
        {SOURCES.map((source) => {
          const isActive = source.id === current;

          return (
            <div
              key={source.id}
              role="region"
              aria-label={source.label}
              inert={!isActive}
              className={`[grid-area:1/1] ${isActive ? "" : "invisible"}`}
            >
              {panels[source.id]}
            </div>
          );
        })}
      </div>
    </div>
  );
}
