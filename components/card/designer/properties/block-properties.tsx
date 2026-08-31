"use client";

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
  MAX_BLOCK_MARGIN,
  MAX_BLOCK_PADDING,
  defaultMarginOf,
  isNarrow,
  isSelfSized,
  type CardBlock,
  type CardBlockAlign,
  type CardBlockType,
} from "@/packages/shared/card-layout";
import { BLOCK_LABELS, zonesSentence } from "../block-labels";
import { PropertyChoice, PropertySlider } from "./property-fields";

/** What a control on this panel can change about the selected block. */
export type BlockPatch = Partial<
  Pick<
    CardBlock,
    "widthPct" | "heightPct" | "padding" | "align" | "margin" | "overlapPct"
  >
> & {
  // Spelled out rather than picked off `CardBlock`, where it is `"contain" |
  // undefined` — the control needs a word for "fill" that is not the absence of
  // an answer, since `undefined` already means "leave this alone". Matches the
  // patch type `resizeCardBlock` takes, and so do the two below, for the same
  // reason: stretch and "over the block above" are both said by a field not
  // being there, and a control cannot press a missing field.
  fit?: "cover" | "contain";
  valign?: "start" | "center" | "end";
  overlapEdge?: "above" | "below";
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

/** Which neighbour a block is pulled over. Named as the two ends of a card. */
const OVERLAP_OPTIONS = [
  { value: "above", label: "The block above" },
  { value: "below", label: "The block below" },
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
 */
export function BlockProperties({
  block,
  cardPadding,
  overlapsNothing,
  aloneOnLine,
  onChange,
}: {
  block: CardBlock;
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

  return (
    <section className="space-y-3">
      <div>
        <h3 className="text-sm font-semibold text-foreground">
          {BLOCK_LABELS[block.type].label}
        </h3>
        <p className="text-xs text-muted">Goes in {zonesSentence(spec.zones)}.</p>
      </div>

      {has("height") ? (
        <PropertySlider
          label={HEIGHT_LABELS[block.type] ?? "Height"}
          value={block.heightPct ?? spec.defaultHeightPct ?? 0}
          min={1}
          max={spec.maxHeightPct ?? 100}
          suffix="% of the card"
          onChange={(heightPct) => onChange({ heightPct })}
        />
      ) : null}

      {has("fit") ? (
        <PropertyChoice
          label="Photo"
          // Absent is the crop the gallery has always drawn, so that is what the
          // control has to show — not a third "unset" state nobody asked for.
          value={block.fit ?? "cover"}
          options={FIT_OPTIONS}
          onChange={(fit) => onChange({ fit })}
        />
      ) : null}

      {/*
       * One control, where there used to be two that had to agree.
       *
       * There was a **Size** pair of buttons — Full or Half — that put the block
       * on a shared line, and a **Width** slider that narrowed a block still
       * owning its whole line; the slider was hidden while Half was on, because
       * a half's width was its share of the line and a percentage on top would
       * have been a second opinion about the same number. Two ways to say how
       * wide something is, one of which could only say one number.
       *
       * Now the width *is* the answer to both: anything under 100% leaves the
       * rest of the line open, and that room is a drop target (`sideSlots` in
       * lib/card/drop-slots.ts). Half is what you get by dragging this to 50.
       */}
      {has("width") ? (
        <>
          <PropertySlider
            label="Width"
            value={block.widthPct ?? 100}
            min={spec.minWidthPct ?? 25}
            max={100}
            suffix="% of the card"
            onChange={(widthPct) => onChange({ widthPct })}
          />
          {/* Said only while it is true, and said as what the owner gets rather
              than as what the model does (§8). A full-width block has no room
              beside it to explain. */}
          {narrow ? (
            <p className="-mt-1 text-xs text-muted">
              The rest of the line stays open — drop another block into it.
            </p>
          ) : null}
        </>
      ) : null}

      {/*
       * A mark's Alignment goes away once it shares a line — see `aloneOnLine`.
       * The drag says the same thing: picking a logo up draws the three places
       * it can sit across each run of free space, and dropping on one writes
       * this very field (`splitAlignColumns`), so the buttons and the gesture
       * are two ways to the same number rather than two competing ideas.
       */}
      {has("align") && (aloneOnLine || !isSelfSized(block.type)) ? (
        <PropertyChoice
          label="Alignment"
          // Left is what unset text has always drawn as, so that is what the
          // control has to show — not a fourth "unset" state nobody asked for.
          value={block.align ?? "start"}
          options={ALIGN_OPTIONS}
          onChange={(align) => onChange({ align })}
        />
      ) : null}

      {/*
       * Only while the block shares a line. A full-width block *is* its line —
       * exactly as tall as itself — so there is nothing here for this to move,
       * and this panel's rule is that a control shown is a control that takes
       * effect. Same reasoning as Margin below, in the opposite direction.
       */}
      {has("valign") && narrow ? (
        <PropertyChoice
          label="Vertical"
          // Stretching starts at the top for everything made of words, so Top is
          // what an unset block has to show — not a fourth state nobody chose.
          value={block.valign ?? "start"}
          options={VALIGN_OPTIONS}
          onChange={(valign) => onChange({ valign })}
        />
      ) : null}

      {has("overlap") ? (
        <>
          <PropertySlider
            label="Overlap"
            value={block.overlapPct ?? 0}
            min={0}
            max={100}
            suffix="% over its neighbour"
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
          {/* Said only while it is true, and said as what to do about it rather
              than as what the model does (§8). */}
          {block.overlapPct && overlapsNothing ? (
            <p className="-mt-1 text-xs text-muted">
              Nothing to overlap here — move it next to the photo, in the same
              part of the card.
            </p>
          ) : null}
        </>
      ) : null}

      {has("margin") && !narrow ? (
        <PropertySlider
          label="Margin"
          // The card's own padding is where an untouched block sits, so that is
          // what the slider has to show — not zero, which would read as "this
          // block has no margin" while it visibly does.
          value={block.margin ?? defaultMarginOf(block.type, cardPadding)}
          min={0}
          max={MAX_BLOCK_MARGIN}
          suffix={"px from the card’s edge"}
          onChange={(margin) => onChange({ margin })}
        />
      ) : null}

      {has("padding") ? (
        <PropertySlider
          label="Padding"
          value={block.padding ?? 0}
          min={0}
          max={MAX_BLOCK_PADDING}
          suffix="px inside the block"
          onChange={(padding) => onChange({ padding })}
        />
      ) : null}
    </section>
  );
}
