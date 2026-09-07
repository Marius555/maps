"use client";

import { Accordion } from "@heroui/react";

import { ColorPickerField } from "@/components/ui/color-picker-field";
import type { MapField, Place } from "@/lib/repositories/types";
import {
  findBlock,
  type CardLayout,
  type CardShadow,
  type CardZone,
} from "@/packages/shared/card-layout";
import { blockPanelFacts } from "@/lib/card/block-panel-facts";
import { BlockProperties, type BlockPatch } from "./block-properties";
import { PropertyChoice, PropertyScale } from "@/components/ui/properties/property-fields";
import { PropertyNumberSelect } from "@/components/ui/properties/property-select";
import {
  BORDER_WIDTHS,
  CARD_BLURS,
  CARD_GAP,
  CARD_HEIGHTS,
  CARD_OPACITIES,
  CARD_PADDING,
  CARD_WIDTHS,
  RADIUS_STOPS,
} from "./property-scales";
import { PropertyFold } from "@/components/ui/properties/property-fold";

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
  logoSample,
  mapId,
  chipPreview,
  onChipPreview,
  fields,
  onCard,
  onBlock,
  onMoveBlockZone,
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
  logoSample: Place | null;
  mapId: string;
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
  /**
   * Move a block to another band of the card — see `onMoveZone` in
   * `BlockProperties`, which is what this reaches. The designer holds it because
   * moving a block between zones is a `dropCardBlock`, not a `resizeCardBlock`.
   */
  onMoveBlockZone: (id: string, zone: CardZone) => void;
}) {
  const selected = selectedId ? findBlock(layout, selectedId) : null;

  if (selected) {
    /*
     * The two facts about the zone that the panel cannot work out from the one
     * block it is handed -- shared with the card's own edit mode, which opens
     * this same panel over a pin. See `blockPanelFacts`.
     */
    const { overlapsNothing, aloneOnLine } = blockPanelFacts(
      layout,
      selected.zone,
      selected.index,
      selected.block,
    );

    return (
      <BlockProperties
        block={selected.block}
        fields={fields}
        cardPadding={layout.padding}
        overlapsNothing={overlapsNothing}
        aloneOnLine={aloneOnLine}
        logoHasImage={logoHasImage}
        logoSample={logoSample}
        mapId={mapId}
        chipPreview={chipPreview}
        onChipPreview={onChipPreview}
        zone={selected.zone}
        onMoveZone={(zone) => onMoveBlockZone(selected.block.id, zone)}
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

      {/* Folded exactly as the block panel is, and for its reason: the two
          halves of this tab are one screen, and a flat column on one side
          against a stack of folds on the other would read as two different
          panels. See `PropertyFold`. */}
      <Accordion allowsMultipleExpanded defaultExpandedKeys={["size"]}>
        <PropertyFold id="size" title="Size">
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
        </PropertyFold>

        <PropertyFold id="spacing" title="Spacing">
          {/* Selects, not tiles. Both of these are `room()` scales — None /
              Tight / Regular / Roomy / Wide — and five words across this column
              is about 36px of room each, so every one of them clipped. It is
              the argument Transparency below already makes, applied to the two
              controls whose *labels* were the visible half of the complaint. */}
          <PropertyNumberSelect
            label="Padding"
            value={layout.padding}
            options={CARD_PADDING}
            onChange={(padding) => onCard({ padding })}
          />
          <PropertyNumberSelect
            label="Gap between blocks"
            value={layout.gap}
            options={CARD_GAP}
            onChange={(gap) => onCard({ gap })}
          />
        </PropertyFold>

        {/* Corners sits here rather than under Size: a radius is not how big
            the card is, it is what its edge looks like — the same question the
            shadow and the border answer. */}
        <PropertyFold id="style" title="Style">
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
            // Label above, like every other control in this column — see
            // `labelPlacement`. The publish designer's Colours fold keeps the
            // label inside, because there it is five colours and nothing else.
            labelPlacement="outside"
            onChange={(background) => onCard({ background })}
            onClear={() => onCard({ background: undefined })}
          />

          {/*
           * Directly under the colour it makes see-through, and a select rather
           * than five tiles for the reason the results panel's own Transparency
           * gives: five words across this column is about 60px each and none of
           * them are readable.
           *
           * **Solid stores the absence**, not the number 100 — which is what
           * every card designed before this control existed already says, and
           * what keeps `isDefaultCardLayout` able to leave an untouched card out
           * of the snapshot entirely (CLAUDE.md §7).
           */}
          <PropertyNumberSelect
            label="Transparency"
            value={layout.backgroundOpacity ?? OPAQUE}
            options={CARD_OPACITIES}
            onChange={(value) =>
              onCard({
                backgroundOpacity: value === OPAQUE ? undefined : value,
              })
            }
          />

          {/* Only once there is something for the blur to show through, on the
              rule the border width below already follows: a control that
              visibly does nothing is the one thing this panel does not do. It
              is also what `panel-group.tsx` does with the same pair. */}
          {(layout.backgroundOpacity ?? OPAQUE) < OPAQUE ? (
            <PropertyScale
              label="Blur behind"
              value={layout.backdropBlur ?? 0}
              options={CARD_BLURS}
              onChange={(value) =>
                onCard({ backdropBlur: value === 0 ? undefined : value })
              }
            />
          ) : null}

          <ColorPickerField
            label="Border"
            value={layout.border ?? ""}
            labelPlacement="outside"
            onChange={(border) => onCard({ border })}
            onClear={() => onCard({ border: undefined })}
          />

          {/* Only once there is a colour for it to be a width of. A border of
              two pixels and no colour is a control that visibly does nothing,
              which is the one thing this panel does not do — and it is the
              pattern the chips' own outline now copies. */}
          {layout.border ? (
            <PropertyNumberSelect
              label="Border width"
              value={layout.borderWidth}
              options={BORDER_WIDTHS}
              onChange={(borderWidth) => onCard({ borderWidth })}
            />
          ) : null}
        </PropertyFold>
      </Accordion>
    </section>
  );
}

/**
 * The transparency a card has when nobody has set one.
 *
 * Named rather than written as `100` at four call sites, because it is doing
 * two jobs there: it is the value the control shows for an unset card, and it
 * is the value that means "store nothing".
 */
const OPAQUE = 100;

const SHADOW_OPTIONS = [
  { value: "none", label: "None" },
  { value: "soft", label: "Soft" },
  { value: "strong", label: "Strong" },
] as const satisfies readonly { value: CardShadow; label: string }[];
