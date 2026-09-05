import {
  AlignLeft,
  BadgeCheck,
  Clock,
  Heading,
  Images,
  Link2,
  MapPin,
  Minus,
  MousePointerClick,
  MoveVertical,
  Tag,
  Tags,
  ChevronsUpDown,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";

import type { CardBlockType } from "@/packages/shared/card-layout";

/**
 * What each block is called, in the owner's language rather than ours.
 *
 * Here and not in packages/shared deliberately: the embed renders blocks and
 * never names them, so shipping a table of English labels to every visitor would
 * be bytes for something nothing draws. It is the same split `SnapshotPinIcon`
 * makes by leaving a pin's name out of the snapshot.
 *
 * Names follow CLAUDE.md §8 — what the customer controls, never how the system
 * works. "Photos", not "gallery block"; "Opening hours", not "hours".
 */
export const BLOCK_LABELS: Record<
  CardBlockType,
  { label: string; hint: string; icon: LucideIcon }
> = {
  gallery: {
    label: "Photos",
    hint: "The location's pictures, one at a time",
    icon: Images,
  },
  logo: {
    label: "Logo",
    // Named by where it comes from, so nobody looks for an upload button that
    // is not here (§8). The pin is designed in Pin studio; this is that pin,
    // drawn large.
    hint: "The location's pin, over the photo",
    icon: BadgeCheck,
  },
  name: {
    label: "Name",
    hint: "What the location is called",
    icon: Heading,
  },
  // Retired, and only ever seen on a layout saved before categories became
  // tags — the palette does not offer it (`availableBlocks`). Named for what it
  // now draws rather than for what it was, so an owner opening such a layout is
  // not told about a feature that no longer exists.
  category: {
    label: "Main tag",
    hint: "The tag that colours the pin",
    icon: Tag,
  },
  tags: {
    label: "Tags",
    // Named for what a visitor does with them, not for the column they live in:
    // the tags are also the filter chips, and the two are the same words.
    hint: "The filters this location matches",
    icon: Tags,
  },
  address: {
    label: "Address",
    hint: "Street, town and postcode",
    icon: MapPin,
  },
  description: {
    label: "Description",
    hint: "The paragraph you wrote about it",
    icon: AlignLeft,
  },
  hours: {
    label: "Opening hours",
    hint: "The week, opening on today",
    icon: Clock,
  },
  // Retired, and only ever seen on a layout saved before it was — the palette
  // does not offer it (`availableBlocks`). It could only ever hold the
  // description and the week, so the hint names those two rather than promising
  // a fold that holds "whatever you have not placed", which it never did.
  details: {
    label: "More details",
    hint: "A fold for the description and the week, if you take them off",
    icon: ChevronsUpDown,
  },
  actions: {
    label: "Links",
    hint: "Phone, email, website and directions",
    icon: Link2,
  },
  button: {
    label: "Button",
    // Named by what it does, not by what it is: "Button" alone says how it is
    // drawn and nothing about why you would want one (§8).
    hint: "One call to action — directions, or a link you choose",
    icon: MousePointerClick,
  },
  divider: {
    label: "Divider",
    hint: "A line between two blocks",
    icon: Minus,
  },
  spacer: {
    label: "Space",
    hint: "Empty room between two blocks",
    icon: MoveVertical,
  },
};

/** Where a block is allowed to go, said in a sentence. */
export function zonesSentence(zones: readonly string[]): string {
  const names = zones.map((zone) =>
    zone === "top" ? "top" : zone === "middle" ? "middle" : "bottom",
  );

  if (names.length === 3) return "anywhere on the card";
  if (names.length === 1) return `the ${names[0]} only`;

  return `the ${names.slice(0, -1).join(", ")} or ${names[names.length - 1]}`;
}

/**
 * The two blocks that still render and are never offered.
 *
 * `CARD_BLOCKS[type].retired` is the runtime rule and `availableBlocks` is what
 * enforces it; this is the same fact at the type level, so `UnshelvedBlock`
 * below can tell "nobody filed it" apart from "deliberately not offered".
 */
type RetiredBlockType = "category" | "details";

/**
 * The palette's shelves, and the order blocks are offered in.
 *
 * `CARD_BLOCKS` is keyed by type, and its `Object.keys` order is an
 * implementation detail of a table the embed also reads. This is the *owner's*
 * order, grouped by the question each block answers — what the location says,
 * what it shows, what a visitor can do with it, and how the card is spaced out.
 * It lives here with `BLOCK_LABELS` for that table's own reason: English the
 * dashboard needs and the embed must never ship.
 *
 * `compact` is the one shelf whose rows carry no hint. "Divider" and "Space"
 * say themselves, and two words on two lines each is a shelf of mostly nothing,
 * so `BlockPalette` draws that one two-up.
 */
export const BLOCK_GROUPS = [
  {
    id: "content",
    label: "Content",
    types: ["name", "address", "description", "tags", "hours"],
  },
  { id: "media", label: "Media", types: ["gallery", "logo"] },
  { id: "actions", label: "Actions", types: ["actions", "button"] },
  { id: "layout", label: "Layout", types: ["divider", "spacer"], compact: true },
] as const satisfies readonly {
  id: string;
  label: string;
  types: readonly CardBlockType[];
  compact?: true;
}[];

/**
 * Compile-time proof that every block the palette can offer is on a shelf.
 *
 * A new `CardBlockType` that nobody filed would be a block that exists, drops
 * onto a card perfectly well, and is offered nowhere — the one failure this
 * grouping introduces and the one nothing at runtime would report. `BLOCK_LABELS`
 * is a `Record` and so forces its own entry; this is that guarantee for the
 * shelves. Add the type to a group, or to `RetiredBlockType` if it is one.
 */
type UnshelvedBlock = Exclude<
  CardBlockType,
  (typeof BLOCK_GROUPS)[number]["types"][number] | RetiredBlockType
>;

export const EVERY_BLOCK_IS_SHELVED: [UnshelvedBlock] extends [never]
  ? true
  : never = true;
