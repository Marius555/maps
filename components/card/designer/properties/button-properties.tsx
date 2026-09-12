"use client";

import { useState } from "react";

import { SelectControl } from "@/components/ui/select-control";
import { linkForDisplay, linkForStorage } from "@/lib/card/button-link";
import type { MapField } from "@/lib/repositories/types";
import {
  MAX_BUTTON_HREF,
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

/**
 * The "Link to" entry that means "a link I will type", rather than a place to
 * look on the location.
 *
 * A key for the picker and **never a stored value** — `buttonHref` being present
 * is what actually records the choice. It carries a colon so that even if it did
 * somehow reach storage it could not be mistaken for a custom field id, which is
 * the same care `buttonSource` takes in the other direction by spelling Website
 * as the absence rather than as a word.
 */
const OWN_LINK = ":own-link";

export function ButtonProperties({
  block,
  fields,
  allowsOwnLink,
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
  /**
   * Whether this panel may offer a link typed out in full.
   *
   * True in the per-pin card menu and false in the studio, and the asymmetry is
   * the point: this design is saved per account and drawn for every location on
   * every map, so a URL on it would send three thousand pins to one page — while
   * a per-pin override is one whole block against one place, which is exactly one
   * card. See `CardBlock.buttonHref`.
   */
  allowsOwnLink: boolean;
  onChange: (patch: BlockPatch) => void;
}) {
  const isLink = block.buttonAction === "link";

  /*
   * Whether the picker is sitting on "a link I'll type".
   *
   * Local, and seeded from the block rather than derived from it on every
   * render, because the *empty* box has to survive: `buttonHref` is deleted when
   * it is blank (an empty string in a snapshot is bytes for nothing — CLAUDE.md
   * §0), so a mode read straight off the field would flip back to the picker the
   * moment somebody cleared what they had typed.
   */
  const [ownLink, setOwnLink] = useState(block.buttonHref !== undefined);
  const isOwnLink = allowsOwnLink && (ownLink || block.buttonHref !== undefined);

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
    ...(allowsOwnLink
      ? [
          {
            id: OWN_LINK,
            label: "A link I'll type",
            description: "Just this location's card",
          },
        ]
      : []),
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
            value={isOwnLink ? OWN_LINK : (block.buttonSource ?? "")}
            onChange={(source) => {
              setOwnLink(source === OWN_LINK);

              // Picking a place to look clears anything typed, and picking the
              // typed entry clears the source: the resolver prefers the typed
              // link, so leaving both would hide which one is answering.
              onChange(
                source === OWN_LINK
                  ? { buttonSource: "" }
                  : { buttonSource: source, buttonHref: "" },
              );
            }}
          />

          {isOwnLink ? (
            <PropertyText
              label="Link"
              value={linkForDisplay(block.buttonHref)}
              // The default said out loud rather than an invented example — the
              // shape of the answer, not a site anybody should think is saved.
              placeholder="acme.com/book"
              prefix="https://"
              maxLength={MAX_BUTTON_HREF}
              onChange={(typed) =>
                onChange({ buttonHref: linkForStorage(typed) })
              }
            />
          ) : null}

          {/* Said only while it is true, and said as what to do about it rather
              than as what the model does (§8). A map with no custom fields is
              the normal state of a new account, and a picker offering only the
              two answers every location already has reads as broken rather than
              as empty. */}
          {fields.length === 0 && !isOwnLink ? (
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
