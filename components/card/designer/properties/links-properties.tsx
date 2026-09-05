"use client";

import { Globe, Mail, Navigation, Phone } from "lucide-react";

import { PropertyToggles } from "@/components/ui/properties/property-toggles";
import type { CardBlock } from "@/packages/shared/card-layout";
import type { BlockPatch } from "./block-properties";

/**
 * Which of the four ways to reach a place this row draws.
 *
 * **Every one starts on, and that is the model rather than a nicety.** The
 * fields behind them are spelled as the *hidden* state (`hidePhone`, not
 * `showPhone`), because every card already live on a customer's site draws all
 * four — so shown has to be what a card carrying none of these fields says. See
 * their note in packages/shared/card-layout.ts.
 *
 * The reason to have them at all is the Button block: once one press can carry
 * Directions, the owner needs a way to stop this row saying the same thing in
 * smaller type directly above it.
 *
 * A location with nothing in a field still draws nothing for it — unticking is
 * about the design, not about the data, and the two are asked separately.
 *
 * **One line of icons, where this was four stacked checkboxes.** It is one
 * question with four parts — which of these does the row draw — and a checkbox
 * each spent four two-line controls of a 24rem column saying so, interleaved
 * with the fields around them so the panel read as booleans scattered through
 * it. These four have the most over-learned icons on the web, so the tile draws
 * the thing it is choosing and costs no label width at all; the word survives in
 * the tooltip and in `sr-only` text. Same control, same argument, as the publish
 * designer's own "Each row shows".
 */
const LINKS = [
  { value: "phone", label: "Phone", icon: Phone },
  { value: "email", label: "Email", icon: Mail },
  { value: "website", label: "Website", icon: Globe },
  { value: "directions", label: "Directions", icon: Navigation },
] as const;

type LinkKey = (typeof LINKS)[number]["value"];

/** The stored field each toggle writes, and it is the *hidden* one. */
const HIDDEN_FIELD: Record<LinkKey, keyof BlockPatch> = {
  phone: "hidePhone",
  email: "hideEmail",
  website: "hideWebsite",
  directions: "hideDirections",
};

export function LinksProperties({
  block,
  onChange,
}: {
  block: CardBlock;
  onChange: (patch: BlockPatch) => void;
}) {
  const shown = LINKS.filter(
    (link) => !block[HIDDEN_FIELD[link.value] as keyof CardBlock],
  ).map((link) => link.value);

  return (
    <PropertyToggles
      label="Show"
      options={LINKS}
      selected={shown}
      onChange={(value, isSelected) =>
        /* `true` or absent, never `false` — see the docblock. Turning one back
           on deletes the field rather than storing the negative, which is what
           every card published before these existed already says. */
        onChange({ [HIDDEN_FIELD[value]]: isSelected ? undefined : true })
      }
    />
  );
}
