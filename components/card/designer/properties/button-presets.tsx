"use client";

import { Label, Radio, RadioGroup } from "@heroui/react";
import type { CSSProperties } from "react";

import type { CardBlock } from "@/packages/shared/card-layout";
import type { BlockPatch } from "./block-properties";

/**
 * Five looks a button can start from, as a row of swatches.
 *
 * The first thing in the Button group, because it is the first decision: every
 * button arrived as the same filled accent box and had to be built up one
 * slider at a time, which is a panel that can only be used by someone who
 * already knows what they are aiming at. A preset is that aim, pressed once.
 *
 * **A preset sets the treatment and the shape, and never the colour.** That is
 * the whole of what makes them safe to press twice: an owner who has picked
 * their brand red and then tries Outline keeps the red, because the swatches are
 * painted *from* `buttonBackground` rather than writing it. Colour is the one
 * thing on this panel that is unambiguously the owner's, and a control that
 * silently reset it would be a control nobody presses a second time.
 *
 * Nothing here is a new capability. Each preset is a combination of the fields
 * the group below already offers, so the panel and the swatches cannot disagree
 * — press Outline and the Corners tile and the Hover row move to match.
 */

/** What a swatch draws and what pressing it writes. */
type ButtonPreset = {
  id: string;
  label: string;
  patch: BlockPatch;
};

/**
 * The corner every preset but Pill writes.
 *
 * The stylesheet's own `0.5rem`, said out loud. Writing it rather than clearing
 * the field is deliberate: a preset is the owner styling the button, and the
 * radius tile has to have something to show as selected afterwards. It draws
 * exactly what an unstyled button draws, so nothing moves on screen.
 */
const BASE_RADIUS = 8;

/**
 * The presets, in the order someone reads them: the filled box first, then the
 * two ways to be quieter than it, then the two shapes.
 *
 * Every one writes the **same set of fields**, so pressing a second preset
 * cannot leave half of the first behind — which is what would happen if, say,
 * only Outline mentioned the border pair.
 */
const BUTTON_PRESETS: readonly ButtonPreset[] = [
  {
    id: "solid",
    label: "Solid",
    patch: {
      buttonVariant: "solid",
      buttonRadius: BASE_RADIUS,
      buttonBorder: "",
      buttonBorderWidth: 0,
    },
  },
  {
    id: "outline",
    label: "Outline",
    patch: {
      buttonVariant: "outline",
      buttonRadius: BASE_RADIUS,
      // The line comes from the treatment, which reads the button's own colour
      // and stays theme-aware — see `.card-button--outline`. A stored pair here
      // would freeze it to one literal.
      buttonBorder: "",
      buttonBorderWidth: 0,
    },
  },
  {
    id: "soft",
    label: "Soft",
    patch: {
      buttonVariant: "soft",
      buttonRadius: BASE_RADIUS,
      buttonBorder: "",
      buttonBorderWidth: 0,
    },
  },
  {
    id: "pill",
    label: "Pill",
    patch: {
      buttonVariant: "solid",
      // `MAX_BUTTON_RADIUS`, which is past half the height of any button this
      // panel can build — so the corners resolve to a true pill rather than to
      // a number that happens to look like one at today's type size.
      buttonRadius: 28,
      buttonBorder: "",
      buttonBorderWidth: 0,
    },
  },
  {
    id: "ghost",
    label: "Ghost",
    patch: {
      buttonVariant: "ghost",
      buttonRadius: BASE_RADIUS,
      buttonBorder: "",
      buttonBorderWidth: 0,
    },
  },
];

/**
 * Which preset the button is currently wearing, or `null` for none of them.
 *
 * `null` is the normal state rather than an edge case: every slider in the group
 * below can take the button somewhere no preset describes, and a row that kept
 * one swatch lit through that would be claiming something untrue. It is also
 * why the group does not disallow an empty selection.
 */
function activePreset(block: CardBlock): string | null {
  const variant = block.buttonVariant ?? "solid";
  const radius = block.buttonRadius ?? BASE_RADIUS;

  return (
    BUTTON_PRESETS.find(
      (preset) =>
        preset.patch.buttonVariant === variant &&
        preset.patch.buttonRadius === radius,
    )?.id ?? null
  );
}

export function ButtonPresets({
  block,
  onChange,
}: {
  block: CardBlock;
  onChange: (patch: BlockPatch) => void;
}) {
  const active = activePreset(block);

  /*
   * The owner's own colour, or the accent the stylesheet falls back to.
   *
   * A custom property rather than five copies of the same conditional, and the
   * fallback is a `var()` rather than a literal for the reason every colour on
   * this card is: `--accent` is what an unstyled button actually draws, in
   * whichever theme the panel happens to be open in.
   */
  const swatchVars = {
    "--swatch": block.buttonBackground || "var(--accent)",
  } as CSSProperties;

  return (
    <div className="flex flex-col gap-1.5">
      <Label>Style</Label>

      {/*
       * `orientation="horizontal"` is not decoration — `.radio-group`'s
       * vertical branch puts `mt-4` on every radio after the first, which in a
       * grid is four tiles hanging a row lower than the one beside them. The
       * horizontal branch's own `flex-row flex-wrap gap-4` is then replaced
       * outright by the grid, which is what keeps five equal columns.
       */}
      <RadioGroup
        aria-label="Button style"
        orientation="horizontal"
        className="grid grid-cols-5 gap-1"
        // `null` deselects, which React Aria supports on a controlled group and
        // is what a hand-tuned button has to show.
        value={active}
        onChange={(id) => {
          const preset = BUTTON_PRESETS.find((entry) => entry.id === id);
          if (preset) onChange(preset.patch);
        }}
      >
        {BUTTON_PRESETS.map((preset) => (
          <Radio
            key={preset.id}
            value={preset.id}
            // `group/preset` so the swatch can read the selected state off the
            // radio, which is the element React Aria marks. `.radio` is already
            // a column; this only re-centres it and gives the tile a hit area.
            className="group/preset items-center rounded-lg py-1"
          >
            {/* `Radio.Content` stays and `Radio.Control` does not: the content
                is the clickable row that carries the hidden input and the focus
                state, while the control is only the dot — and the swatch is the
                dot here. Re-laid as a column, which is what puts the name under
                the tile rather than beside it. */}
            <Radio.Content className="flex-col gap-1 text-center outline-none">
              <span
                aria-hidden="true"
                style={swatchVars}
                className={`h-8 w-8 ring-offset-2 ring-offset-surface transition-[box-shadow] group-data-selected/preset:ring-2 group-data-selected/preset:ring-accent ${SWATCH_CLASS[preset.id] ?? ""}`}
              />
              {/* 11px, the panel's own small print — see `PropertyCheckbox`. */}
              <span className="text-[11px] leading-tight text-muted group-data-selected/preset:text-foreground">
                {preset.label}
              </span>
            </Radio.Content>
          </Radio>
        ))}
      </RadioGroup>
    </div>
  );
}

/**
 * How each swatch is painted — the same four treatments the card draws, in
 * miniature.
 *
 * Written as classes over `--swatch` rather than as inline styles, so a tile is
 * the *same* `color-mix` the button is rather than a hand-mixed approximation
 * that drifts the first time `.card-button--soft` is adjusted.
 *
 * **Pill is a pill and not a circle**, which is the one departure from a row of
 * equal discs. Its difference from Solid is the corner and nothing else, and two
 * identical circles labelled Solid and Pill would be a control that cannot say
 * what it does. Every other tile is round.
 */
const SWATCH_CLASS: Record<string, string> = {
  solid: "rounded-full bg-[var(--swatch)]",
  outline: "rounded-full border-2 border-[var(--swatch)]",
  soft: "rounded-full bg-[color-mix(in_oklab,var(--swatch)_16%,transparent)]",
  pill: "h-5 self-center rounded-full bg-[var(--swatch)]",
  // A dashed edge, because a ghost button's own edge is nothing at all and a
  // blank tile reads as a swatch that failed to load rather than as a choice.
  ghost:
    "rounded-full border border-dashed border-border bg-[color-mix(in_oklab,var(--swatch)_8%,transparent)]",
};
