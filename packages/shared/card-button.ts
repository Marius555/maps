/**
 * Where a Button block points, and what it says.
 *
 * Its own file rather than more of `card-layout.ts`, on the precedent
 * `logoImageOf` sets there: that file deliberately takes already-resolved values
 * so it stays free of imports about *locations*, and this function is entirely
 * about one. Shared, for `chipStyleOf`'s reason — the studio, the editor's popup
 * and the embed all draw this button, and a second copy of "which of the
 * location's values is the link" is a button that goes somewhere else on the
 * customer's site than it does in the studio.
 *
 * **A source, resolved per location — never a stored URL.** The card design is
 * saved per *account* and drawn for every location on every map, so a URL kept
 * on the block would send three thousand pins to one page. See
 * `CardBlock.buttonSource`.
 */

import {
  directionsUrl,
  type DirectionsOrigin,
  type DirectionsTarget,
} from "./directions";
import type { CardBlock } from "./card-layout";

/**
 * The least a location must be for a button to be drawn against it.
 *
 * Structural, so both the dashboard's domain `Place` and the embed's
 * `SnapshotPlace` satisfy it without either being converted into the other.
 */
export type CardButtonPlace = DirectionsTarget & {
  url?: string | null;
  fields?: Record<string, string> | null;
};

/** The least a custom field must be for a button to read it. */
export type CardButtonField = {
  id: string;
  label: string;
  type: "text" | "url" | "tel" | "email";
};

export type CardButtonTarget = {
  href: string;
  label: string;
};

/**
 * What the Links row calls the location's own website, and what a button set to
 * that source falls back to. One string so the two rows cannot disagree.
 */
export const WEBSITE_LABEL = "Website";

/** What a directions button says when nobody has renamed it. */
export const DIRECTIONS_LABEL = "Directions";

/**
 * Where this button goes for this location — or nothing, and nothing is the
 * common case worth designing for.
 *
 * `null` means the block draws nothing and takes no space, which is the rule
 * every other block already follows: one layout has to be right for three
 * thousand locations that are each filled in differently, and a button to a
 * booking page is only a button on the locations that have one.
 *
 * The label is resolved here too, because the fallback is part of the answer: a
 * custom field's own label is what the card's CTA rows have always used in
 * preference to its value, since a URL's value is forty characters of tracking
 * parameters.
 */
export function buttonTargetOf(
  block: CardBlock,
  place: CardButtonPlace,
  fields: readonly CardButtonField[],
  /**
   * Where the visitor is, for the directions case alone. Optional and absent by
   * default, which is the link this has always returned — the dashboard has no
   * visitor to locate and passes nothing.
   */
  from?: DirectionsOrigin | null,
): CardButtonTarget | null {
  // Absent is directions — see `CardBlock.buttonAction` for why that is the way
  // round it is.
  if (block.buttonAction !== "link") {
    return {
      href: directionsUrl(place, from),
      label: block.buttonLabel ?? DIRECTIONS_LABEL,
    };
  }

  /*
   * A link typed out for this one location beats everything the design points
   * at — it is only ever written on a per-pin override, so there is exactly one
   * card it can be about. `null` rather than a fall-through when it will not
   * parse: an owner who typed a link meant *that* link, and quietly drawing the
   * location's website instead is a button that goes somewhere nobody chose.
   */
  if (block.buttonHref) {
    const href = safeHref(block.buttonHref);

    return href ? { href, label: block.buttonLabel ?? WEBSITE_LABEL } : null;
  }

  // Absent is the location's own website, which is why this is a `find` over
  // the id rather than a lookup that has to be told about a sentinel first.
  if (!block.buttonSource) {
    const href = safeHref(place.url);

    return href ? { href, label: block.buttonLabel ?? WEBSITE_LABEL } : null;
  }

  const field = fields.find((candidate) => candidate.id === block.buttonSource);
  if (!field) return null;

  const value = place.fields?.[field.id];
  if (!value) return null;

  const href = fieldHref(field.type, value);
  if (!href) return null;

  return { href, label: block.buttonLabel ?? field.label };
}

/**
 * A custom field's value as somewhere to go, following the field's own type.
 *
 * `text` has no answer and returns nothing, which is the one place this differs
 * from the CTA rows in the Links block: those render a button-shaped field with
 * no link type as plain text, because dropping something the owner filled in is
 * worse than showing it unlinked. A Button block is a control, and a control
 * that cannot be pressed is worse than one that is not there.
 */
function fieldHref(type: CardButtonField["type"], value: string): string | null {
  if (type === "tel") return `tel:${value}`;
  if (type === "email") return `mailto:${value}`;
  if (type === "url") return safeHref(value);

  return null;
}

/**
 * http(s) only.
 *
 * The same check the card's own website link makes, and for its reason: a `url`
 * field is customer input, it is written into an `href` on a stranger's page,
 * and `javascript:` is a URL too. The embed's `link()` checks again on the way
 * into the DOM — belt and braces, the way the width floor is checked twice.
 */
function safeHref(value: string | null | undefined): string | null {
  if (!value) return null;

  try {
    const url = new URL(value);

    return url.protocol === "http:" || url.protocol === "https:"
      ? url.href
      : null;
  } catch {
    return null;
  }
}
