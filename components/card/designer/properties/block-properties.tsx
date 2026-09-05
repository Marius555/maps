"use client";

import { Accordion } from "@heroui/react";
import {
  AlignCenter,
  AlignLeft,
  AlignRight,
  AlignVerticalJustifyCenter,
  AlignVerticalJustifyEnd,
  AlignVerticalJustifyStart,
} from "lucide-react";

import {
  CARD_BLOCKS,
  DEFAULT_CLAMP_LINES,
  defaultMarginOf,
  isNarrow,
  isSelfSized,
  type CardBlock,
  type CardBlockAlign,
  type CardBlockType,
  type CardButtonHover,
  type CardButtonVariant,
} from "@/packages/shared/card-layout";
import type { MapField, Place } from "@/lib/repositories/types";
import { BLOCK_LABELS, zonesSentence } from "../block-labels";
import { ButtonProperties } from "./button-properties";
import { ButtonStyleProperties } from "./button-style-properties";
import { ChipProperties } from "./chip-properties";
import { LinksProperties } from "./links-properties";
import { HoursProperties } from "./hours-properties";
import { LogoProperties } from "./logo-properties";
import { PreviewProperties } from "./preview-properties";
import {
  PropertyCheckbox,
  PropertyChecks,
  PropertyChoice,
  PropertyScale,
} from "@/components/ui/properties/property-fields";
import { PropertyNumberSelect } from "@/components/ui/properties/property-select";
import {
  BLOCK_MARGIN,
  BLOCK_PADDING,
  CLAMP_LINES,
  OVERLAP_STOPS,
  heightStops,
  widthStops,
} from "./property-scales";
import { PropertyFold } from "@/components/ui/properties/property-fold";
import { TextProperties } from "./text-properties";

/** What a control on this panel can change about the selected block. */
export type BlockPatch = Partial<
  Pick<
    CardBlock,
    | "widthPct"
    | "heightPct"
    | "padding"
    | "align"
    | "margin"
    | "overlapPct"
    | "font"
    | "fontSize"
    | "color"
    | "hoursRowGap"
    | "clampLines"
    | "chipPadding"
    | "chipBorderWidth"
    | "buttonPadding"
    | "buttonRadius"
    | "buttonBorderWidth"
  >
> & {
  // Spelled out rather than picked off `CardBlock`, where it is `"contain" |
  // undefined` — the control needs a word for "fill" that is not the absence of
  // an answer, since `undefined` already means "leave this alone". Matches the
  // patch type `resizeCardBlock` takes, and so do the rest below, for the same
  // reason: stretch, "over the block above", not-bold, a collapsed week and a
  // whole pin are all said by a field not being there, and a control cannot
  // press a missing field.
  fit?: "cover" | "contain";
  valign?: "start" | "center" | "end";
  overlapEdge?: "above" | "below";
  bold?: boolean;
  hoursOpen?: boolean;
  hoursLongDays?: boolean;
  logoMode?: "pin" | "image" | "mixed";
  logoRadius?: "square" | "rounded" | "round";
  // Spelled out too, for `color`'s reason one field over: an empty string is how
  // the Reset beside the picker says "back to the ground this theme draws", and
  // `undefined` already means "leave it alone".
  chipBackground?: string;
  chipBorder?: string;
  /*
   * What the button does. Spelled out with `"directions"` in it rather than
   * picked off `CardBlock`, where it is `"link" | undefined`: the control needs
   * a word for the default, since `undefined` already means "leave this alone".
   * Same shape as `fit` and `logoMode` above.
   */
  buttonAction?: "link" | "directions";
  /*
   * Its source and its label, both carrying their absence as the empty string —
   * `chipBackground`'s idiom, which is what lets one control offer a value and
   * a way back to the default without a second verb.
   */
  buttonSource?: string;
  buttonLabel?: string;
  buttonBackground?: string;
  buttonBorder?: string;
  buttonFull?: boolean;
  /*
   * How the button's ground is painted, and what it does under the pointer.
   *
   * Each carries its own default as a word — `"solid"` and `"darken"` — which
   * `CardBlock` does not have, for the reason `fit` carries `"cover"` above:
   * `undefined` already means "leave this alone", so a control pressing its way
   * *back* to the default needs something to say. `resizeCardBlock` turns those
   * two words back into the field's absence, which is what every card published
   * before these existed already says.
   */
  buttonVariant?: "solid" | CardButtonVariant;
  buttonHover?: "darken" | CardButtonHover;
  /*
   * The four ways to reach a place a Links row leaves out. `boolean`, so the
   * checkbox being ticked back *on* has a word — see `bold` above.
   */
  hidePhone?: boolean;
  hideEmail?: boolean;
  hideWebsite?: boolean;
  hideDirections?: boolean;
};

/**
 * Fill crops what does not fit; Fit shows the whole picture inside the box.
 *
 * The words the owner is choosing between, not `object-fit`'s (§8): what they
 * are deciding is whether the photo fills the height they set or sits inside it.
 */
const FIT_OPTIONS = [
  { value: "cover", label: "Fill" },
  { value: "contain", label: "Fit" },
] as const satisfies readonly { value: "cover" | "contain"; label: string }[];

/**
 * What the Height control is called on the types where "height" is the wrong
 * word for it.
 *
 * A logo is drawn square, so its height is its diameter — and nobody dragging a
 * logo bigger is thinking about its height. One entry rather than a label on the
 * spec, because this is the panel's vocabulary and `CARD_BLOCKS` is the model's.
 */
const HEIGHT_LABELS: Partial<Record<CardBlockType, string>> = { logo: "Size" };

/**
 * Which neighbour a block is pulled over.
 *
 * One word each. They were "The block above" and "The block below", and those
 * two `whitespace-nowrap` labels are the documented reason the tab panel needs
 * `overflow-x-hidden` at all (../card-designer-tabs.tsx) — a second scrollbar on
 * a 24rem column, bought with the width every other control was short of. The
 * question is already asked by the "Overlaps" label directly above them, so the
 * buttons only ever had to answer it.
 */
const OVERLAP_OPTIONS = [
  { value: "above", label: "Above" },
  { value: "below", label: "Below" },
] as const satisfies readonly { value: "above" | "below"; label: string }[];

/**
 * Top, middle and bottom of the line — the *cross* axis, which is only a
 * question once a block shares its line with another.
 *
 * "Stretch" is not offered as a fourth button even though it is what an
 * unaligned block does: it is the state the field says by not being there, and
 * Top is what it looks like for everything made of words. A photo beside it
 * still fills the line either way.
 */
const VALIGN_OPTIONS = [
  {
    value: "start",
    label: "Top",
    icon: <AlignVerticalJustifyStart aria-hidden className="size-3.5" />,
  },
  {
    value: "center",
    label: "Middle",
    icon: <AlignVerticalJustifyCenter aria-hidden className="size-3.5" />,
  },
  {
    value: "end",
    label: "Bottom",
    icon: <AlignVerticalJustifyEnd aria-hidden className="size-3.5" />,
  },
] as const satisfies readonly {
  value: "start" | "center" | "end";
  label: string;
  icon: React.ReactNode;
}[];

const ALIGN_OPTIONS = [
  { value: "start", label: "Left", icon: <AlignLeft aria-hidden className="size-3.5" /> },
  { value: "center", label: "Centre", icon: <AlignCenter aria-hidden className="size-3.5" /> },
  { value: "end", label: "Right", icon: <AlignRight aria-hidden className="size-3.5" /> },
] as const satisfies readonly { value: CardBlockAlign; label: string; icon: React.ReactNode }[];

/**
 * The selected block's own controls, and only the ones it declares.
 *
 * The panel is a walk over `CARD_BLOCKS[type].controls` rather than a chain of
 * questions about how the block is sized, and that is the whole fix: the old
 * version derived what to show from `sizing`, which meant Opening hours got an
 * empty panel while an address got a "Height limit" that did nothing except clip
 * the second half of the street behind a scrollbar inside a card that already
 * scrolls. `resizeCardBlock` reads the same list, so a control that appears here
 * is a control that takes effect.
 *
 * **Those controls are grouped by the question they answer**, which is the other
 * half. As one flat column they were thirteen rows at one rhythm — a width
 * slider, an overlap, a font, a chip colour and a week's row spacing — with
 * nothing saying that some of them change the block's *box* and some change what
 * is *inside* it. The groups are, in the order somebody works in them: where the
 * block goes and how big it is, how much room is around it, what it says, what
 * its words look like, what its chips look like, and last the one control that
 * changes nothing but the preview. See `PropertyFold`.
 */
export function BlockProperties({
  block,
  fields,
  cardPadding,
  overlapsNothing,
  aloneOnLine,
  logoHasImage,
  logoSample,
  isOwnCard,
  mapId,
  chipPreview,
  onChipPreview,
  onChange,
}: {
  block: CardBlock;
  /**
   * This map's custom fields, for the Button block's source picker — the only
   * control on this panel whose options come from outside the layout.
   */
  fields: MapField[];
  /** What an untouched margin resolves to, for the slider to start at. */
  cardPadding: number;
  /**
   * Whether this block is at the end of its zone that its overlap points at —
   * so the overlap currently moves nothing.
   *
   * An overlap is against a sibling in the same zone (`blockEdges` in
   * components/card/card-frame.tsx), and a block at the end of one has none. The
   * control stays rather than being hidden, because the fix is to move the block
   * and the panel is where someone would look to find that out.
   */
  overlapsNothing: boolean;
  /**
   * Whether this block has its line to itself.
   *
   * Only a **mark** reads it, and only for Alignment. A logo alone on its line
   * is positioned across the zone's column by `align`; give it a neighbour and
   * its position is wherever that neighbour leaves it, so the three buttons stop
   * moving anything. Every other block's `align` is `text-align` on its own
   * words, which a line-mate cannot touch.
   */
  aloneOnLine: boolean;
  /**
   * Whether the sample location's pin carries an uploaded image — so the Logo
   * block's "Logo" mode has something to draw. See `LogoProperties`.
   */
  logoHasImage: boolean;
  /** The location the canvas draws, whose own logo the Logo panel uploads. */
  logoSample: Place | null;
  /**
   * Whether `logoSample` is the location this panel was opened over, rather than
   * a stand-in the canvas picked. Only the Logo panel reads it, to decide
   * whether an upload needs explaining -- see `LogoProperties`.
   */
  isOwnCard?: boolean;
  mapId: string;
  /**
   * How many chips the preview is padded to. `null` is the sample's own.
   *
   * **Optional, and its absence hides the group.** It is the one control on this
   * panel that writes nothing to the design -- it pads the *canvas* so somebody
   * can see what four chips would do to a card built against a location wearing
   * one. Opened over a real pin on the map (`BlockEditorForm`) there is nothing
   * to pretend about: that card is the card, and a control that padded it would
   * be showing chips this location does not have.
   */
  chipPreview?: number | null;
  onChipPreview?: (count: number | null) => void;
  onChange: (patch: BlockPatch) => void;
}) {
  const spec = CARD_BLOCKS[block.type];
  const has = (control: (typeof spec.controls)[number]) =>
    spec.controls.includes(control);

  // A margin only means anything at full width. A narrowed block has already
  // opted out of deciding where its own edges sit, and it never gets one at all,
  // because two blocks each pulling out to the card's edges make a line wider
  // than the card (packages/shared/card-layout.ts).
  const narrow = isNarrow(block);

  /*
   * Each conditional control's own answer, worked out once.
   *
   * A group has to know whether every control in it is hidden before it draws
   * its heading — five headings over one slider is what a spacer's panel would
   * otherwise be — and React counts a `false` as a child, so `PropertyFold`
   * cannot work that out from what it is handed. These are the same conditions
   * the JSX below reads; naming them is what lets both use one answer.
   */
  const showAlign = has("align") && (aloneOnLine || !isSelfSized(block.type));
  const showValign = has("valign") && narrow;
  const showMargin = has("margin") && !narrow;

  /*
   * The same answers again, as a table — because the folds need them twice.
   *
   * Once to decide whether to render at all (`PropertyFold`'s `isEmpty`), and
   * once to decide which one starts open. Declaration order is the order on
   * screen, which is what makes `find` below mean "the first one".
   */
  const emptyGroups: Record<string, boolean> = {
    size:
      !has("height") &&
      !has("fit") &&
      !has("width") &&
      !showAlign &&
      !showValign &&
      !has("overlap"),
    spacing: !showMargin && !has("padding"),
    content:
      !has("logo") &&
      !has("clamp") &&
      !has("hours") &&
      !has("button") &&
      !has("links"),
    text: !has("text"),
    chips: !has("chips"),
    button: !has("buttonStyle"),
    preview: !has("chips") || !onChipPreview,
  };

  /*
   * One fold open, and it has to be found rather than named.
   *
   * The publish designer can write `defaultExpandedKeys={["panel"]}` because its
   * four folds are always all there. These are not: which controls a block
   * offers is the block's own business, so a hard-coded id lands on a spacer
   * with Size & position hidden and opens nothing at all — a panel of shut
   * drawers, which is the failure this whole arrangement exists to avoid.
   */
  const firstOpen = Object.entries(emptyGroups).find(
    ([, isEmpty]) => !isEmpty,
  )?.[0];

  return (
    /* `space-y-4` — `SectionPanel`'s own body rhythm, so this panel is spaced
       like every other panel in the app. It was `space-y-2.5`, squeezed to make
       the controls fit without scrolling; the tab panel scrolls
       (`card-designer-tabs.tsx`) and there was never anything to buy with it. */
    <section className="space-y-4">
      {/* The name and where it may go on one line: the zones are a fact about
          the block worth having to hand, not a paragraph under a heading. */}
      <h3 className="flex items-baseline justify-between gap-2 text-xs font-semibold text-foreground">
        {BLOCK_LABELS[block.type].label}
        <span className="font-normal text-[11px] text-muted">
          {zonesSentence(spec.zones)}
        </span>
      </h3>

      {/*
        Folds, where this was a flat `divide-y` column of always-open groups.

        The argument for always-open was that the panel already scrolls, so
        folding buys height that was never scarce and costs a click on the way to
        every control. What it did not weigh is that a block can offer seven
        groups and around twenty controls at 24rem, and a column that long is one
        nobody reads down — the same thing the Blocks palette and the publish
        designer both concluded, and this is now the third panel to agree.

        `key={block.id}` so picking a different block re-opens the default rather
        than inheriting whatever was left open on the last one, whose folds are
        not even the same set.
      */}
      <Accordion
        key={block.id}
        allowsMultipleExpanded
        defaultExpandedKeys={firstOpen ? [firstOpen] : []}
      >
        <PropertyFold
          id="size"
          title="Size & position"
          isEmpty={emptyGroups.size}
        >
          {has("height") ? (
            <PropertyScale
              label={HEIGHT_LABELS[block.type] ?? "Height"}
              value={block.heightPct ?? spec.defaultHeightPct ?? 0}
              // Built around this type's own default rather than by cutting its
              // range into five — see `heightStops`. Dragging the block's own
              // handle still sets any number in between; the tiles light the
              // nearest one.
              options={heightStops(
                spec.defaultHeightPct ?? 0,
                spec.maxHeightPct ?? 100,
              )}
              onChange={(heightPct) => onChange({ heightPct })}
            />
          ) : null}

          {has("fit") ? (
            <PropertyChoice
              label="Photo"
              // Absent is the crop the gallery has always drawn, so that is what
              // the control has to show — not a third "unset" state nobody asked
              // for.
              value={block.fit ?? "cover"}
              options={FIT_OPTIONS}
              onChange={(fit) => onChange({ fit })}
            />
          ) : null}

          {/*
           * One control, where there used to be two that had to agree.
           *
           * There was a **Size** pair of buttons — Full or Half — that put the
           * block on a shared line, and a **Width** slider that narrowed a block
           * still owning its whole line; the slider was hidden while Half was
           * on, because a half's width was its share of the line and a
           * percentage on top would have been a second opinion about the same
           * number. Two ways to say how wide something is, one of which could
           * only say one number.
           *
           * Now the width *is* the answer to both: anything under 100% leaves
           * the rest of the line open, and that room is a drop target
           * (`sideSlots` in lib/card/drop-slots.ts). Half is what you get by
           * dragging this to 50.
           */}
          {has("width") ? (
            <>
              <PropertyScale
                label="Width"
                value={block.widthPct ?? 100}
                options={widthStops(spec.minWidthPct ?? 25)}
                onChange={(widthPct) => onChange({ widthPct })}
              />
              {/* Said only while it is true, and said as what the owner gets
                  rather than as what the model does (§8). A full-width block has
                  no room beside it to explain. */}
              {narrow ? (
                <p className="-mt-1 text-xs text-muted">
                  The rest of the line stays open — drop another block into it.
                </p>
              ) : null}
            </>
          ) : null}

          {/*
           * A mark's Alignment goes away once it shares a line — see
           * `aloneOnLine`. The drag says the same thing: picking a logo up draws
           * the three places it can sit across each run of free space, and
           * dropping on one writes this very field (`splitAlignColumns`), so the
           * buttons and the gesture are two ways to the same number rather than
           * two competing ideas.
           */}
          {showAlign ? (
            <PropertyChoice
              label="Alignment"
              // Left is what unset text has always drawn as, so that is what the
              // control has to show — not a fourth "unset" state nobody asked
              // for.
              value={block.align ?? "start"}
              options={ALIGN_OPTIONS}
              onChange={(align) => onChange({ align })}
            />
          ) : null}

          {/*
           * Only while the block shares a line. A full-width block *is* its line
           * — exactly as tall as itself — so there is nothing here for this to
           * move, and this panel's rule is that a control shown is a control
           * that takes effect. Same reasoning as Margin below, in the opposite
           * direction.
           */}
          {showValign ? (
            <PropertyChoice
              label="Vertical"
              // Stretching starts at the top for everything made of words, so
              // Top is what an unset block has to show — not a fourth state
              // nobody chose.
              value={block.valign ?? "start"}
              options={VALIGN_OPTIONS}
              onChange={(valign) => onChange({ valign })}
            />
          ) : null}

          {has("overlap") ? (
            <>
              <PropertyScale
                label="Overlap"
                value={block.overlapPct ?? 0}
                options={OVERLAP_STOPS}
                onChange={(overlapPct) => onChange({ overlapPct })}
              />
              {block.overlapPct ? (
                <PropertyChoice
                  label="Overlaps"
                  value={block.overlapEdge ?? "above"}
                  options={OVERLAP_OPTIONS}
                  onChange={(overlapEdge) => onChange({ overlapEdge })}
                />
              ) : null}
              {/* Said only while it is true, and said as what to do about it
                  rather than as what the model does (§8). */}
              {block.overlapPct && overlapsNothing ? (
                <p className="-mt-1 text-xs text-muted">
                  Nothing to overlap here — move it next to the photo, in the
                  same part of the card.
                </p>
              ) : null}
            </>
          ) : null}
        </PropertyFold>

        <PropertyFold id="spacing" title="Spacing" isEmpty={emptyGroups.spacing}>
          {showMargin ? (
            <PropertyNumberSelect
              label="Margin"
              // The card's own padding is where an untouched block sits, so that
              // is what the control has to show — not zero, which would read as
              // "this block has no margin" while it visibly does.
              value={block.margin ?? defaultMarginOf(block.type, cardPadding)}
              options={BLOCK_MARGIN}
              onChange={(margin) => onChange({ margin })}
            />
          ) : null}

          {has("padding") ? (
            <PropertyNumberSelect
              label="Padding"
              value={block.padding ?? 0}
              options={BLOCK_PADDING}
              onChange={(padding) => onChange({ padding })}
            />
          ) : null}
        </PropertyFold>

        {/*
         * What the block *says*, as opposed to the box it says it in.
         *
         * This is the distinction the flat column could not draw, and it is the
         * one somebody arranging a card actually feels: a clipped description, a
         * week showing only today and a mark drawn as a logo rather than a pin
         * are all changes to the content, and they sat interleaved with sliders
         * that moved the box around them.
         */}
        <PropertyFold id="content" title="Content" isEmpty={emptyGroups.content}>
          {has("button") ? (
            <ButtonProperties
              block={block}
              fields={fields}
              onChange={onChange}
            />
          ) : null}

          {has("links") ? (
            <LinksProperties block={block} onChange={onChange} />
          ) : null}

          {has("logo") ? (
            <LogoProperties
              block={block}
              hasImage={logoHasImage}
              sample={logoSample}
              isOwnCard={isOwnCard}
              mapId={mapId}
              onChange={onChange}
            />
          ) : null}

          {has("clamp") ? (
            <>
              <PropertyChecks>
                <PropertyCheckbox
                  label="Show it in full"
                  isSelected={!block.clampLines}
                  onChange={(whole) =>
                    onChange({ clampLines: whole ? 0 : DEFAULT_CLAMP_LINES })
                  }
                />
              </PropertyChecks>

              {block.clampLines ? (
                <PropertyScale
                  label="Lines"
                  value={block.clampLines}
                  options={CLAMP_LINES}
                  onChange={(clampLines) => onChange({ clampLines })}
                />
              ) : null}
            </>
          ) : null}

          {has("hours") ? (
            <HoursProperties block={block} onChange={onChange} />
          ) : null}
        </PropertyFold>

        <PropertyFold id="text" title="Text" isEmpty={emptyGroups.text}>
          {has("text") ? (
            <TextProperties
              block={block}
              // Every block but the week, which draws Bold in with its own two
              // checkboxes instead — see `HoursProperties`.
              showBold={block.type !== "hours"}
              onChange={onChange}
            />
          ) : null}
        </PropertyFold>

        {/* After the text, because a chip is the box those words sit in and the
            order here is the order someone works in — what it says, then what it
            says it in, then what it is drawn on. */}
        <PropertyFold id="chips" title="Chips" isEmpty={emptyGroups.chips}>
          {has("chips") ? (
            <ChipProperties block={block} onChange={onChange} />
          ) : null}
        </PropertyFold>

        {/* After the text, for the reason the Chips group is: a button is the
            box its label sits in, and the order here is what it says, then what
            it says it in, then what it is drawn on. */}
        <PropertyFold id="button" title="Button" isEmpty={emptyGroups.button}>
          {has("buttonStyle") ? (
            <ButtonStyleProperties block={block} onChange={onChange} />
          ) : null}
        </PropertyFold>

        {/* Last, and the only group here that writes nothing to the design. Its
            own heading is what says so — see `PreviewProperties`. Gone entirely
            where there is no canvas to pad — see `chipPreview`. */}
        <PropertyFold id="preview" title="Preview" isEmpty={emptyGroups.preview}>
          {has("chips") && onChipPreview ? (
            <PreviewProperties count={chipPreview ?? null} onCount={onChipPreview} />
          ) : null}
        </PropertyFold>
      </Accordion>
    </section>
  );
}
