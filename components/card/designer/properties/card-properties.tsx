"use client";

import { ColorPickerField } from "@/components/ui/color-picker-field";
import type { MapField } from "@/lib/repositories/types";
import {
  cardRows,
  findBlock,
  type CardLayout,
  type CardShadow,
} from "@/packages/shared/card-layout";
import { BlockProperties, type BlockPatch } from "./block-properties";
import { PropertyChoice, PropertyScale } from "./property-fields";
import {
  BORDER_WIDTHS,
  CARD_GAP,
  CARD_HEIGHTS,
  CARD_PADDING,
  CARD_WIDTHS,
  RADIUS_STOPS,
} from "./property-scales";
import { PropertyGroup, PropertyGroups } from "./property-group";

/**
 * The numbers behind the card, for the things a drag cannot say.
 *
 * A handle is the right way to set a height you can see; it is the wrong way to
 * set a corner radius of exactly 12, and there is no handle at all for "how wide
 * is this card". Every control here writes through the same clamped edits the
 * drags do, so the two cannot disagree about what is allowed.
 *
 * One control set at a time: a block's own while something is selected, the
 * whole card's otherwise — selecting a block to nudge its height must not also
 * put every other block's size one careless drag away.
 */
export function CardProperties({
  layout,
  selectedId,
  logoHasImage,
  chipPreview,
  onChipPreview,
  fields,
  onCard,
  onBlock,
}: {
  layout: CardLayout;
  selectedId: string | null;
  /**
   * Whether the sample location's pin carries an uploaded image.
   *
   * Passed straight through to the block panel, which is the only thing that
   * asks — a Logo block set to draw its logo has nothing to draw without one,
   * and the panel says so rather than offering a button that quietly does
   * nothing. Worked out in `CardDesigner`, which is where the sample is.
   */
  logoHasImage: boolean;
  /**
   * How many chips the canvas pads the sample's tags to. `null` is the
   * location's own.
   *
   * The one thing on this panel that is **not** part of the design: it changes
   * the preview and nothing else, and it is threaded through here rather than
   * held in the panel because the canvas is what has to draw it. See
   * lib/card/preview-chips.ts.
   */
  chipPreview: number | null;
  onChipPreview: (count: number | null) => void;
  /**
   * This map's custom fields, passed straight through to the Button block's
   * source picker — the one control on either panel whose options come from
   * outside the layout being edited.
   */
  fields: MapField[];
  onCard: (patch: Partial<CardLayout>) => void;
  onBlock: (id: string, patch: BlockPatch) => void;
}) {
  const selected = selectedId ? findBlock(layout, selectedId) : null;

  if (selected) {
    /*
     * Whether the block's overlap currently has a neighbour to overlap.
     *
     * Worked out here rather than in the panel because it is a fact about the
     * *zone*, and the panel is handed one block. The rule is `blockEdges`'s in
     * components/card/card-frame.tsx: a block is pulled over a sibling in its own
     * zone, so the first block of one has nothing above it and the last has
     * nothing below.
     */
    const list = layout.zones[selected.zone];
    const overlapsNothing =
      selected.block.overlapEdge === "below"
        ? selected.index === list.length - 1
        : selected.index === 0;

    /*
     * Whether the block has its line to itself.
     *
     * A fact about the *line*, so it is worked out here for the same reason
     * `overlapsNothing` is: the panel is handed one block, and only the zone
     * knows what is next to it. It is what decides whether a mark's Alignment
     * control has anything to move — a logo sharing a line sits where its
     * neighbours leave it, and three buttons that quietly do nothing are exactly
     * what this panel's own rule forbids.
     */
    const alone =
      cardRows(list, layout).find((row) =>
        row.blocks.some((block) => block.id === selected.block.id),
      )?.blocks.length === 1;

    return (
      <BlockProperties
        block={selected.block}
        fields={fields}
        cardPadding={layout.padding}
        overlapsNothing={overlapsNothing}
        aloneOnLine={alone}
        logoHasImage={logoHasImage}
        chipPreview={chipPreview}
        onChipPreview={onChipPreview}
        onChange={(patch) => onBlock(selected.block.id, patch)}
      />
    );
  }

  return (
    /* `space-y-4` for the reason `BlockProperties` uses it — see there. */
    <section className="space-y-4">
      <h3 className="flex items-baseline justify-between gap-2 text-xs font-semibold text-foreground">
        The card
        <span className="font-normal text-[11px] text-muted">
          Select a block to change that
        </span>
      </h3>

      {/* Grouped exactly as the block panel is, and for its reason: the two
          halves of this tab are one screen, and a flat column on one side
          against five headings on the other would read as two different
          panels. See `PropertyGroup`. */}
      <PropertyGroups>
        <PropertyGroup title="Size">
          <PropertyScale
            label="Width"
            value={layout.width}
            options={CARD_WIDTHS}
            onChange={(width) => onCard({ width })}
          />
          <PropertyScale
            label="Height"
            value={layout.maxHeight}
            options={CARD_HEIGHTS}
            onChange={(maxHeight) => onCard({ maxHeight })}
          />
        </PropertyGroup>

        <PropertyGroup title="Spacing">
          <PropertyScale
            label="Padding"
            value={layout.padding}
            options={CARD_PADDING}
            onChange={(padding) => onCard({ padding })}
          />
          <PropertyScale
            label="Gap between blocks"
            value={layout.gap}
            options={CARD_GAP}
            onChange={(gap) => onCard({ gap })}
          />
        </PropertyGroup>

        {/* Corners sits here rather than under Size: a radius is not how big
            the card is, it is what its edge looks like — the same question the
            shadow and the border answer. */}
        <PropertyGroup title="Style">
          {/* The same five tiles the button's corners are, out of one table —
              two controls with one word between them that drew two different
              kinds of control was the panel disagreeing with itself. */}
          <PropertyScale
            label="Corners"
            value={layout.radius}
            options={RADIUS_STOPS}
            onChange={(radius) => onCard({ radius })}
          />

          <PropertyChoice
            label="Shadow"
            value={layout.shadow}
            options={SHADOW_OPTIONS}
            onChange={(shadow) => onCard({ shadow })}
          />

          {/*
           * The two colours the model has carried since the beginning with
           * nothing able to set them.
           *
           * Unset is the point of both, and is why each has a Reset rather than
           * a swatch that merely looks neutral: absent means "the surface
           * colour of whichever theme this card is drawn in", which is what
           * keeps a card readable on a visitor's dark map. A stored `#ffffff`
           * would look deliberate while being wrong
           * (packages/shared/card-layout.ts).
           */}
          <ColorPickerField
            label="Background"
            value={layout.background ?? ""}
            fallback="#ffffff"
            onChange={(background) => onCard({ background })}
            onClear={() => onCard({ background: undefined })}
          />

          <ColorPickerField
            label="Border"
            value={layout.border ?? ""}
            onChange={(border) => onCard({ border })}
            onClear={() => onCard({ border: undefined })}
          />

          {/* Only once there is a colour for it to be a width of. A border of
              two pixels and no colour is a control that visibly does nothing,
              which is the one thing this panel does not do — and it is the
              pattern the chips' own outline now copies. */}
          {layout.border ? (
            <PropertyScale
              label="Border width"
              value={layout.borderWidth}
              options={BORDER_WIDTHS}
              onChange={(borderWidth) => onCard({ borderWidth })}
            />
          ) : null}
        </PropertyGroup>
      </PropertyGroups>
    </section>
  );
}

const SHADOW_OPTIONS = [
  { value: "none", label: "None" },
  { value: "soft", label: "Soft" },
  { value: "strong", label: "Strong" },
] as const satisfies readonly { value: CardShadow; label: string }[];
