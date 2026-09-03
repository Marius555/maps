"use client";

import {
  DEFAULT_HOURS_ROW_GAP,
  type CardBlock,
} from "@/packages/shared/card-layout";
import type { BlockPatch } from "./block-properties";
import {
  PropertyCheckbox,
  PropertyChecks,
  PropertyScale,
} from "./property-fields";
import { HOURS_GAP } from "./property-scales";

/**
 * The four things only a week of opening times can be asked.
 *
 * All three are the block's own rather than the card's, because a card can hold
 * exactly one week and what it should look like depends entirely on what the
 * owner is running: a shop open the same hours every day wants one line, a venue
 * with a different Sunday wants seven.
 *
 * **"Show only today" is ticked by default, and that is not a preference.** A
 * published card has always drawn this collapsed (`buildHours` in
 * embed/src/popup.ts is a `<details>`), so the *absence* of the field has to
 * keep meaning closed or every map already live on a customer's site would open
 * its hours the day this shipped. Unticking is what writes something down.
 */
export function HoursProperties({
  block,
  onChange,
}: {
  block: CardBlock;
  onChange: (patch: BlockPatch) => void;
}) {
  return (
    <>
      {/*
       * All three yes-or-nos on one line, **including Bold**, which every other
       * block draws over in the Text group.
       *
       * They are one question — how does this week read — and split across two
       * groups they were three full-width rows saying three short words. Bold is
       * the one that had to move, because a group heading cannot be crossed; see
       * `showBold` on `TextProperties`, which is how it stops being drawn twice.
       */}
      <PropertyChecks cols={3}>
        <PropertyCheckbox
          label="Bold"
          isSelected={Boolean(block.bold)}
          onChange={(bold) => onChange({ bold })}
        />

        <PropertyCheckbox
          label="Only today"
          isSelected={!block.hoursOpen}
          onChange={(collapsed) => onChange({ hoursOpen: !collapsed })}
        />

        <PropertyCheckbox
          label="Full day names"
          isSelected={Boolean(block.hoursLongDays)}
          onChange={(hoursLongDays) => onChange({ hoursLongDays })}
        />
      </PropertyChecks>

      <PropertyScale
        label="Space between days"
        value={block.hoursRowGap ?? DEFAULT_HOURS_ROW_GAP}
        options={HOURS_GAP}
        onChange={(hoursRowGap) => onChange({ hoursRowGap })}
      />
    </>
  );
}
