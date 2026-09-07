"use client";

import { SelectControl } from "@/components/ui/select-control";
import type { MapField } from "@/lib/repositories/types";
import {
  MAX_BUTTON_LABEL,
  type CardBlock,
} from "@/packages/shared/card-layout";
import {
  DIRECTIONS_LABEL,
  WEBSITE_LABEL,
} from "@/packages/shared/card-button";
import type { BlockPatch } from "./block-properties";
import { PropertyChoice, PropertyText } from "@/components/ui/properties/property-fields";

/**
 * What the button does — as opposed to what it looks like, which is the group
 * below it.
 *
 * The split is the one `text` and `chips` already make on the Tags block: these
 * three answers change where a press *goes*, and a panel that interleaved them
 * with a border colour would have stopped asking one question at a time.
 */

const ACTION_OPTIONS = [
  { value: "directions", label: "Directions" },
  { value: "link", label: "Link" },
] as const satisfies readonly {
  value: "link" | "directions";
  label: string;
}[];

export function ButtonProperties({
  block,
  fields,
  onChange,
}: {
  block: CardBlock;
  /**
   * This map's custom fields — the things a link can come *from*.
   *
   * The card design is saved per account and drawn on every map, so this list
   * describes the map the designer happens to be open against rather than the
   * design. A button bound to a field another map does not have draws nothing
   * there, which is the same thing it does for a location that left the field
   * blank (see `CardBlock.buttonSource`).
   */
  fields: MapField[];
  onChange: (patch: BlockPatch) => void;
}) {
  const isLink = block.buttonAction === "link";

  /*
   * The location's own website first, then the map's own fields.
   *
   * Website is the empty string because it is the *absence* of a source — one
   * way to say it, and no reserved word a field id could ever collide with. The
   * `SelectControl` takes a string key, so the absence has a key like anything
   * else.
   */
  const sources = [
    { id: "", label: WEBSITE_LABEL, description: "The location's own link" },
    ...fields.map((field) => ({
      id: field.id,
      label: field.label,
      description: FIELD_DESCRIPTIONS[field.type],
    })),
  ];

  return (
    <>
      <PropertyChoice
        label="Action"
        // Directions is the absence — see `CardBlock.buttonAction` — so that is
        // what the control has to show, not a third "unset" state nobody asked
        // for.
        value={isLink ? "link" : "directions"}
        options={ACTION_OPTIONS}
        onChange={(buttonAction) => onChange({ buttonAction })}
      />

      {/*
       * Only in link mode, because directions have no source to pick: a
       * coordinate is the one thing a location cannot be missing. This panel's
       * rule is that a control shown is a control that takes effect.
       */}
      {isLink ? (
        <>
          <SelectControl
            label="Link to"
            variant="secondary"
            options={sources}
            value={block.buttonSource ?? ""}
            onChange={(buttonSource) => onChange({ buttonSource })}
          />

          {/* Said only while it is true, and said as what to do about it rather
              than as what the model does (§8). A map with no custom fields is
              the normal state of a new account, and a picker with one entry
              reads as broken rather than as empty. */}
          {fields.length === 0 ? (
            <p className="-mt-1 text-xs text-muted py-2">
              Add custom fields in Settings to give each location its own link.
            </p>
          ) : null}
        </>
      ) : null}

      <PropertyText
        label="Label"
        value={block.buttonLabel ?? ""}
        // The default said out loud, so an empty box reads as "this is what you
        // get" rather than as a button with no words on it.
        placeholder={isLink ? WEBSITE_LABEL : DIRECTIONS_LABEL}
        maxLength={MAX_BUTTON_LABEL}
        onChange={(buttonLabel) => onChange({ buttonLabel })}
      />
    </>
  );
}

/**
 * What each kind of custom field turns into when a button reads it.
 *
 * Worth saying in the picker rather than leaving to be discovered: a `text`
 * field has no link in it at all, so a button bound to one draws nothing, and
 * finding that out by selecting it and watching the card go blank is a worse
 * way to learn it.
 */
const FIELD_DESCRIPTIONS: Record<MapField["type"], string> = {
  url: "Opens in a new tab",
  tel: "Taps to call",
  email: "Opens the visitor's mail app",
  text: "Not a link — the button won't show",
};
