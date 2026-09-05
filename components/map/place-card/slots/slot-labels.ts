import type { CardSlot } from "@/lib/card/card-slots";

/**
 * What each slot is offering to add, in the owner's language.
 *
 * Keyed by the slot rather than by the block, which is not the same table as
 * `BLOCK_LABELS`: a slot names the *field* being filled in, and two block types
 * can ask for one field ("Main tag" and "Tags" both add a tag) while one block
 * type can ask for several (the Links row wants a phone, an email or a website).
 * Naming them after the blocks would have the button on an empty Links row say
 * "Add links", which is not a thing anybody has.
 *
 * These are read out loud: the slot is an icon with no visible words, so this is
 * its accessible name — "Add opening hours" is what a screen reader announces
 * and what the popover is titled. §8's rule about naming things by what the user
 * controls applies with more force than usual here, for that reason.
 */
export function slotLabel(slot: CardSlot): string {
  switch (slot.kind) {
    case "photos":
      return "photos";
    case "name":
      return "a name";
    case "tags":
      return "tags";
    case "address":
      return "an address";
    case "description":
      return "a description";
    case "hours":
      return "opening hours";
    case "contact":
      return "contact details";
    case "url":
      return "a website";
    case "field":
      return "a link";
    case "logo":
      return "a logo";
  }
}

/** The same thing as a sentence-case heading, for the popover's own title. */
export function slotTitle(slot: CardSlot): string {
  const label = slotLabel(slot);

  return `Add ${label}`;
}
