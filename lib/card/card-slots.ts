import type { MapField, Place } from "@/lib/repositories/types";
import { buttonTargetOf } from "@/packages/shared/card-button";
import type { CardBlock } from "@/packages/shared/card-layout";
import { isEmptyHours } from "@/packages/shared/hours";
import type { TagChip } from "@/packages/shared/tags";

/**
 * What a block on the card is missing for *this* location, and therefore what
 * the dashed slot drawn in its place is offering to add.
 *
 * A card is the design its owner arranged, and since blocks stopped collapsing
 * on a half-filled location (see `renderZone` in components/card/card-view.tsx)
 * an unfilled one is an invisible hole: the space is held, correctly, but
 * nothing on screen distinguishes it from the gap above it. This is what turns
 * that hole into an invitation — the slot sits in the block's own box, at the
 * block's own size, so filling it in moves nothing else on the card.
 *
 * **Editor-only, and this file is what keeps it that way.** Nothing here is
 * imported by `/embed` or reached by `buildSnapshot`: a visitor gets the card as
 * it stands, because "add opening hours" is not a sentence they can act on
 * (CLAUDE.md §2, §4, and the same argument `renderEmptyState` already makes).
 *
 * It cannot be `hasBlockContent`, which answers a neighbouring question:
 *   - that one says **true** for a gallery with no photo, deliberately — the
 *     band is a thing the owner put on the card and holds its place whatever
 *     this location has. But the photo band is the most obvious thing on a card
 *     to offer to fill in, so it is a slot here.
 *   - it answers a boolean, where the slot has to know *which field* to open.
 * The two therefore live side by side rather than one deriving from the other,
 * and the table below is written out in full so a block added to `CardBlockType`
 * has to make a decision here rather than silently inheriting one.
 */
export type CardSlot =
  /** The gallery, which is also how a location gets its first photo. */
  | { kind: "photos" }
  | { kind: "name" }
  | { kind: "tags" }
  | { kind: "address" }
  | { kind: "description" }
  | { kind: "hours" }
  /**
   * The Links row, and *which* of its links this location is missing — the ones
   * the block itself hides are not missing, they were turned off on purpose.
   */
  | { kind: "contact"; phone: boolean; email: boolean; website: boolean }
  /** A Button reading the location's own website. */
  | { kind: "url" }
  /** A Button reading one of the map's custom fields. */
  | { kind: "field"; fieldId: string }
  /** The mark, on a card whose Logo block draws the logo and nothing else. */
  | { kind: "logo" };

/**
 * The slot this block is offering, or `null` — which is the common answer, and
 * the one every filled-in location gives for every block on the card.
 */
export function cardSlotOf(
  block: CardBlock,
  place: Place,
  fields: MapField[],
  tagChips: readonly TagChip[],
  /**
   * Whether the custom pin this location wears carries an uploaded image.
   *
   * Passed in rather than resolved here, so this file stays free of a
   * `pin-icons` import and stays a table of decisions rather than a renderer —
   * the caller has already resolved the pin to draw the card.
   */
  hasPinImage = false,
): CardSlot | null {
  switch (block.type) {
    case "gallery":
      // The one place this parts company with `hasBlockContent`, which reports
      // a photo band as content whether or not there is a picture in it.
      return place.photoUrls[0] ?? place.photoUrl ? null : { kind: "photos" };

    case "name":
      return place.name ? null : { kind: "name" };

    // Both tag blocks, the retired `category` included: it draws this
    // location's first tag, so it is missing exactly what the Tags block is.
    case "category":
    case "tags":
      return tagChips.length > 0 ? null : { kind: "tags" };

    case "address":
      return place.address ? null : { kind: "address" };

    case "description":
      return place.description ? null : { kind: "description" };

    case "hours":
      return isEmptyHours(place.hours) ? { kind: "hours" } : null;

    case "actions":
      return contactSlot(block, place);

    case "button":
      return buttonSlot(block, place, fields);

    /*
     * Only on the mark that is *strictly* a logo.
     *
     * Pin and Mixed always draw something — `resolvePin` answers a plain ball
     * for a location that has never been given an icon, and that is still this
     * location's mark. `logoMode: "image"` is the owner saying this block is the
     * company's logo, so a location without one has genuinely filled in nothing,
     * and this is the `+` that offers the upload. The pin's own image counts:
     * a location wearing a custom pin with a logo on it already has a mark to
     * draw, which is exactly what `logoImageOf` falls back to.
     */
    case "logo":
      return block.logoMode === "image" && !place.logoUrl && !hasPinImage
        ? { kind: "logo" }
        : null;

    /*
     * Never.
     *
     * A `divider` and a `spacer` are shapes rather than content, exactly as
     * present on an empty location as on a full one. And `details` is retired:
     * it folds only the description and the week, both of which are on the card
     * everybody gets, so a slot here would be a second way to reach a field that
     * already has one.
     */
    case "divider":
    case "spacer":
    case "details":
      return null;

    default:
      return null;
  }
}

/**
 * The Links row's missing halves.
 *
 * A row showing Directions is never empty — every location has coordinates —
 * which is why this only ever answers on a row whose owner has turned that off.
 * That is the same conclusion `hasBlockContent` reaches for `actions`, reached
 * the same way, because a slot on a row that is already drawing something would
 * be an invitation stacked on top of content.
 *
 * A custom field showing `showAs: "button"` counts as one of the row's links
 * too, for the same reason it does there — but it is not offered as a slot: the
 * row can carry several and there is no one field to open.
 */
function contactSlot(block: CardBlock, place: Place): CardSlot | null {
  if (!block.hideDirections) return null;

  const phone = !block.hidePhone && !place.phone;
  const email = !block.hideEmail && !place.email;
  const website = !block.hideWebsite && !place.url;

  // Every link the row is allowed to draw is missing, or there is nothing to
  // offer: a row already showing a phone number is a row that drew.
  const drew =
    (!block.hidePhone && Boolean(place.phone)) ||
    (!block.hideEmail && Boolean(place.email)) ||
    (!block.hideWebsite && Boolean(place.url));

  if (drew) return null;
  if (!phone && !email && !website) return null;

  return { kind: "contact", phone, email, website };
}

/**
 * What a Button with nowhere to go is missing.
 *
 * `buttonTargetOf` is the authority on whether it has somewhere — three
 * renderers already ask it, so asking it again here is what stops a slot
 * appearing under a button that draws. What it does *not* say is which value
 * was empty, which is the whole job of this function: absent `buttonSource` is
 * the location's own website, and a value names one of the map's custom fields.
 *
 * A Directions button always resolves, so this is only ever reached for a link.
 * A button bound to a field this map does not have gets no slot: there is
 * nothing to type into, and the answer is to fix the button in the designer.
 */
function buttonSlot(
  block: CardBlock,
  place: Place,
  fields: MapField[],
): CardSlot | null {
  if (buttonTargetOf(block, place, fields) !== null) return null;

  if (!block.buttonSource) return { kind: "url" };

  const field = fields.find((candidate) => candidate.id === block.buttonSource);
  if (!field) return null;

  // A `text` field is never a link, so a button bound to one draws nothing
  // whatever anybody types — see FIELD_DESCRIPTIONS in the designer's panel.
  if (field.type === "text") return null;

  return { kind: "field", fieldId: field.id };
}
