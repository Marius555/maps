import {
  AlignLeft,
  BadgeCheck,
  Clock,
  Heading,
  Images,
  Link2,
  MapPin,
  Minus,
  MoveVertical,
  Rows3,
  Tag,
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
  category: {
    label: "Category",
    hint: "Its coloured category chip",
    icon: Tag,
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
  fields: {
    label: "Extra fields",
    hint: "The fields you added to this map",
    icon: Rows3,
  },
  details: {
    label: "More details",
    hint: "A fold holding whatever you have not placed yourself",
    icon: ChevronsUpDown,
  },
  actions: {
    label: "Links",
    hint: "Phone, email, website and directions",
    icon: Link2,
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
