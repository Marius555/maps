"use client";

import type { CardBlock } from "@/packages/shared/card-layout";
import type { BlockPatch } from "./block-properties";
import { PropertyCheckbox, PropertyChecks } from "./property-fields";

/**
 * Which of the four ways to reach a place this row draws.
 *
 * **Every box starts ticked, and that is the model rather than a nicety.** The
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
 */
export function LinksProperties({
  block,
  onChange,
}: {
  block: CardBlock;
  onChange: (patch: BlockPatch) => void;
}) {
  return (
    <PropertyChecks>
      <PropertyCheckbox
        label="Phone"
        isSelected={!block.hidePhone}
        onChange={(shown) => onChange({ hidePhone: !shown })}
      />
      <PropertyCheckbox
        label="Email"
        isSelected={!block.hideEmail}
        onChange={(shown) => onChange({ hideEmail: !shown })}
      />
      <PropertyCheckbox
        label="Website"
        isSelected={!block.hideWebsite}
        onChange={(shown) => onChange({ hideWebsite: !shown })}
      />
      <PropertyCheckbox
        label="Directions"
        isSelected={!block.hideDirections}
        onChange={(shown) => onChange({ hideDirections: !shown })}
      />
    </PropertyChecks>
  );
}
