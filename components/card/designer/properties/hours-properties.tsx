"use client";

import { Bold, CalendarDays, CaseUpper } from "lucide-react";

import {
  DEFAULT_HOURS_ROW_GAP,
  type CardBlock,
} from "@/packages/shared/card-layout";
import type { BlockPatch } from "./block-properties";
import { PropertyNumberSelect } from "@/components/ui/properties/property-select";
import { PropertyToggles } from "@/components/ui/properties/property-toggles";
import { HOURS_GAP } from "./property-scales";

/**
 * The four things only a week of opening times can be asked.
 *
 * All three are the block's own rather than the card's, because a card can hold
 * exactly one week and what it should look like depends entirely on what the
 * owner is running: a shop open the same hours every day wants one line, a venue
 * with a different Sunday wants seven.
 *
 * **A published card draws this collapsed**, and that is not a preference.
 * `buildHours` in embed/src/popup.ts is a `<details>`, so the *absence* of
 * `hoursOpen` has to keep meaning closed or every map already live on a
 * customer's site would open its hours the day this shipped. Turning **Whole
 * week** on is what writes something down — which is also why it is spelled that
 * way round now: as a checkbox it read "Only today", the inverse of the field,
 * and a toggle that is on when its field is absent is a control that lies about
 * what it stores.
 */
const WEEK = [
  { value: "bold", label: "Bold", icon: Bold },
  { value: "open", label: "Whole week", icon: CalendarDays },
  { value: "longDays", label: "Full day names", icon: CaseUpper },
] as const;

type WeekKey = (typeof WEEK)[number]["value"];

export function HoursProperties({
  block,
  onChange,
}: {
  block: CardBlock;
  onChange: (patch: BlockPatch) => void;
}) {
  /*
   * All three yes-or-nos in one row, **including Bold**, which every other
   * block draws over in the Text group.
   *
   * They are one question — how does this week read — and split across two
   * folds they read as two different subjects. Bold is the one that had to
   * move, because a fold heading cannot be crossed; see `showBold` on
   * `TextProperties`, which is how it stops being drawn twice.
   *
   * They were three stacked checkboxes, which at a word above a 16px box is
   * three two-line controls for one question. Icons cost no label width at all,
   * so the whole question is one line — the argument `PropertyToggles` makes,
   * and the same control the publish designer uses for its own sets.
   */
  const on: WeekKey[] = [
    ...(block.bold ? (["bold"] as const) : []),
    ...(block.hoursOpen ? (["open"] as const) : []),
    ...(block.hoursLongDays ? (["longDays"] as const) : []),
  ];

  return (
    <>
      <PropertyToggles
        label="Week"
        options={WEEK}
        selected={on}
        onChange={(value, isSelected) => {
          if (value === "bold") onChange({ bold: isSelected });
          else if (value === "open") onChange({ hoursOpen: isSelected });
          else onChange({ hoursLongDays: isSelected });
        }}
      />

      {/* A select rather than five tiles: `HOURS_GAP` is a `room()` scale —
          None / Tight / Regular / Roomy / Wide — and five words across this
          column clip every one of them. Its own label is the longest here and
          would wrap besides. */}
      <PropertyNumberSelect
        label="Space between days"
        value={block.hoursRowGap ?? DEFAULT_HOURS_ROW_GAP}
        options={HOURS_GAP}
        onChange={(hoursRowGap) => onChange({ hoursRowGap })}
      />
    </>
  );
}
