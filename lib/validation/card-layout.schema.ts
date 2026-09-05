import { z } from "zod";

import { isCardFont } from "@/packages/shared/card-fonts";
import {
  CARD_BLOCKS,
  CARD_ZONES,
  MAX_BLOCK_FONT_SIZE,
  MAX_BLOCK_MARGIN,
  MAX_BLOCK_OFFSET,
  MAX_BLOCK_PADDING,
  MAX_BUTTON_BORDER_WIDTH,
  MAX_BUTTON_LABEL,
  MAX_BUTTON_PADDING,
  MAX_BUTTON_RADIUS,
  MAX_BUTTON_SOURCE,
  MAX_CHIP_BORDER_WIDTH,
  MAX_CHIP_PADDING,
  MAX_CLAMP_LINES,
  MAX_HOURS_ROW_GAP,
  MIN_BLOCK_FONT_SIZE,
  resolveCardLayout,
  type CardBlockType,
  type CardLayout,
} from "@/packages/shared/card-layout";

/**
 * What the card designer is allowed to save.
 *
 * A column of its own rather than another key in `settings`, on the same
 * argument `appearance` makes: `settings` is the Publish tab's form and is
 * written whole, so two panels writing one blob is a lost update.
 *
 * This validates the *shape*; `resolveCardLayout` in packages/shared enforces
 * the *rules* — which zones a block may sit in, what it may be sized to, that a
 * unique block appears once. Both, deliberately. Zod is what turns a malformed
 * body into a 422 rather than a 500, and the resolver is what keeps a row that
 * got past it — written by an older build, or edited in the console — drawable.
 * Running the resolver at the end of the parse is what makes the stored value
 * already-clamped, so nothing downstream has to wonder.
 */

const BLOCK_TYPES = Object.keys(CARD_BLOCKS) as [CardBlockType, ...CardBlockType[]];

const pct = z.number().int().min(0).max(100);

/** `#rgb` or `#rrggbb`. The same shape `resolveCardLayout`'s own reader takes. */
const HEX = /^#(?:[0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/;

export const cardBlockSchema = z.object({
  id: z.string().trim().min(1).max(64),
  type: z.enum(BLOCK_TYPES),
  widthPct: pct.optional(),
  // `z.boolean()`, not `z.literal(true)`, for the same forgiveness `bleed` below
  // gets: a row hand-edited in the console to `half: false` should reach the
  // resolver, which normalises it away, rather than 422 on the doorstep.
  half: z.boolean().optional(),
  // Whether this half starts its own line rather than joining the one before
  // it, and which end of a line it sits at when it is alone on one. Both are
  // only meaningful on a half, and the resolver is what drops them from
  // anything else — this only has to be a shape.
  newLine: z.boolean().optional(),
  // "start" is accepted and normalised away, for the same forgiveness
  // `half: false` gets above.
  side: z.enum(["start", "end"]).optional(),
  heightPct: pct.optional(),
  // "cover" is accepted and normalised away by the resolver, for the same
  // forgiveness `half: false` and `side: "start"` get above.
  fit: z.enum(["cover", "contain"]).optional(),
  // Pixels, not a percentage — it is set against the card's own padding, which
  // is pixels too. The ceiling is the resolver's; this only has to be a bound.
  padding: z.number().int().min(0).max(MAX_BLOCK_PADDING).optional(),
  align: z.enum(["start", "center", "end"]).optional(),
  // Where the block sits on the cross axis of the line it shares. "start" is
  // accepted and normalised away, for the same forgiveness `side: "start"` gets
  // above.
  valign: z.enum(["start", "center", "end"]).optional(),
  // How far a block is pulled over its neighbour, as a percentage of its own
  // height, and which neighbour that is. "above" is accepted and normalised
  // away; the resolver drops both from any type that cannot overlap.
  overlapPct: pct.optional(),
  overlapEdge: z.enum(["above", "below"]).optional(),
  // Pixels too, and for the same reason: it stands in for the card's own
  // padding for this one block.
  margin: z.number().int().min(0).max(MAX_BLOCK_MARGIN).optional(),
  // Leading space, in pixels. The bound here is the tallest card there can be;
  // `resolveCardLayout` clamps it against *this* card's own height, which is
  // the limit that actually means something.
  offset: z.number().int().min(0).max(MAX_BLOCK_OFFSET).optional(),
  // The boolean `margin` replaced. Still accepted, never written: a layout
  // saved under the old field has to survive a round trip through this schema
  // on its way to `resolveCardLayout`, which is what translates it.
  bleed: z.boolean().optional(),
  /*
   * The type styling.
   *
   * The font is checked against the closed list rather than against a shape,
   * and that is deliberate belt-and-braces with `readBlock`: this string is
   * written into a `font-family` inline on a stranger's website, so a shape
   * that merely looks like a font stack is not good enough. See
   * packages/shared/card-fonts.ts.
   */
  font: z.string().refine(isCardFont).optional(),
  fontSize: z
    .number()
    .int()
    .min(MIN_BLOCK_FONT_SIZE)
    .max(MAX_BLOCK_FONT_SIZE)
    .optional(),
  color: z.string().regex(HEX).optional(),
  // `z.boolean()` rather than `z.literal(true)`, for the forgiveness `half` and
  // `bleed` get above: a `false` hand-written into the row should reach the
  // resolver, which normalises it away, rather than 422 on the doorstep. The
  // same goes for the two hours flags below.
  bold: z.boolean().optional(),
  hoursOpen: z.boolean().optional(),
  hoursLongDays: z.boolean().optional(),
  hoursRowGap: z.number().int().min(0).max(MAX_HOURS_ROW_GAP).optional(),
  clampLines: z.number().int().min(1).max(MAX_CLAMP_LINES).optional(),
  // The chips' ground and how roomy they are. Both bounded here and clamped
  // again by the resolver, which is also what drops them off a block type
  // that does not draw chips at all.
  chipBackground: z.string().regex(HEX).optional(),
  chipPadding: z.number().int().min(0).max(MAX_CHIP_PADDING).optional(),
  // And their outline, which is a pair: the resolver is what refuses to store
  // either half on its own, since a colour with no width draws nothing and a
  // width with no colour draws a line nobody picked.
  chipBorder: z.string().regex(HEX).optional(),
  chipBorderWidth: z
    .number()
    .int()
    .min(0)
    .max(MAX_CHIP_BORDER_WIDTH)
    .optional(),
  // Whether the mark is the pin or the logo inside it. `z.enum` rather than
  // `z.literal("image")`, for the forgiveness `half` and `bleed` get above: the
  // word "pin" hand-written into a row is the default said out loud, and the
  // resolver normalises it away rather than this 422ing on the doorstep.
  logoMode: z.enum(["pin", "image", "mixed"]).optional(),
  // Absent is square. `"square"` is accepted for the forgiveness `logoMode`
  // gets one line up: a control pressing its way back to the default has a word
  // for it, and the resolver turns that word back into the field being absent.
  logoRadius: z.enum(["square", "rounded", "round"]).optional(),
  /*
   * What a button does, where its link comes from, and what it says.
   *
   * `z.enum` rather than `z.literal("link")`, for the forgiveness `logoMode`
   * gets above: "directions" written into a row is the default said out loud,
   * and the resolver normalises it away rather than this 422ing on the
   * doorstep.
   *
   * The label and the source are bounded but not shaped. A label is the owner's
   * own words and the only free text a layout carries — the cap is what stops a
   * hand-edited row writing a paragraph into a control on a stranger's page,
   * and the resolver collapses its whitespace. The source is a custom field id,
   * which is checked by *finding* it rather than by matching a pattern: a
   * button naming a field this map does not have simply draws nothing, which is
   * the same thing it does for a location that left the field blank.
   */
  buttonAction: z.enum(["link", "directions"]).optional(),
  buttonSource: z.string().max(MAX_BUTTON_SOURCE).optional(),
  buttonLabel: z.string().max(MAX_BUTTON_LABEL).optional(),
  // The button's own box. Bounded here and clamped again by the resolver, which
  // is also what drops them off a block type that draws no button — and, for
  // the outline, what refuses to store either half of the pair alone.
  buttonBackground: z.string().regex(HEX).optional(),
  buttonPadding: z.number().int().min(0).max(MAX_BUTTON_PADDING).optional(),
  buttonRadius: z.number().int().min(0).max(MAX_BUTTON_RADIUS).optional(),
  buttonBorder: z.string().regex(HEX).optional(),
  buttonBorderWidth: z
    .number()
    .int()
    .min(0)
    .max(MAX_BUTTON_BORDER_WIDTH)
    .optional(),
  // `z.boolean()` rather than `z.literal(true)`, for the forgiveness above.
  buttonFull: z.boolean().optional(),
  /*
   * The treatment and the hover.
   *
   * Both are `z.enum` for `buttonAction`'s reason, and both leave their default
   * out of the list on purpose: a filled button and a darkening hover are what
   * the *absence* says, and a word for either would be a second spelling of a
   * state every published card already writes as nothing. The resolver narrows
   * against the same two vocabularies, which is what the embed relies on since
   * it turns both into class names.
   */
  buttonVariant: z.enum(["outline", "soft", "ghost"]).optional(),
  buttonHover: z.enum(["none", "lighten", "lift"]).optional(),
  /*
   * The four ways to reach a place a Links row leaves out.
   *
   * Spelled as the hidden state so absent means shown, which is what every card
   * already live on a customer's site says — see the fields' own note in
   * packages/shared/card-layout.ts.
   */
  hidePhone: z.boolean().optional(),
  hideEmail: z.boolean().optional(),
  hideWebsite: z.boolean().optional(),
  hideDirections: z.boolean().optional(),
});

/**
 * A ceiling on how many blocks one card can hold.
 *
 * Not a design rule — the zone rules already stop a card growing anything
 * meaningful — but a bound on the column. Only `divider` and `spacer` repeat, so
 * a real card is under a dozen blocks; this is far above that and still far
 * below anything that could make the row a problem.
 */
const MAX_BLOCKS_PER_ZONE = 24;

const zoneSchema = z.array(cardBlockSchema).max(MAX_BLOCKS_PER_ZONE);

export const cardLayoutSchema = z
  .object({
    v: z.literal(1),
    width: z.number().int(),
    maxHeight: z.number().int(),
    radius: z.number().int(),
    padding: z.number().int(),
    gap: z.number().int(),
    // Absent means "the theme decides", which is the only way a card stays
    // readable on a visitor's dark map. An empty string would not be.
    background: z.string().regex(HEX).optional(),
    // Optional for `background`'s reason one step on: absent means opaque and
    // no blur, which is what every card published before these existed says.
    // Unbounded here and clamped in `resolveCardLayout`, as every other number
    // on this object is.
    backgroundOpacity: z.number().int().optional(),
    backdropBlur: z.number().int().optional(),
    border: z.string().regex(HEX).optional(),
    borderWidth: z.number().int(),
    shadow: z.enum(["none", "soft", "strong"]),
    zones: z.object({
      top: zoneSchema,
      middle: zoneSchema,
      bottom: zoneSchema,
    }),
  })
  // Every number is clamped and every misplaced block dropped on the way
  // through, so what reaches the repository is already the thing that will be
  // drawn. Saving an unclamped layout would mean the designer and the published
  // card could disagree about what was saved.
  .transform((value): CardLayout => resolveCardLayout(value));

export type CardLayoutInput = z.output<typeof cardLayoutSchema>;

/**
 * The stored blob as something renderable.
 *
 * Same contract as `readMapAppearance`: the column is free-form JSON that may
 * have been written by an older build, left empty by every map created before
 * the designer existed, or edited in the console. Never throws.
 */
export function readCardLayout(
  cardLayout: Record<string, unknown>,
): CardLayout {
  return resolveCardLayout(cardLayout);
}

/** Whether this layout is the untouched default, byte for byte. */
export function isDefaultCardLayout(layout: CardLayout): boolean {
  return JSON.stringify(layout) === JSON.stringify(resolveCardLayout({}));
}

/**
 * Whether two layouts are the same card.
 *
 * Both sides go through the resolver first, and that is what makes the
 * comparison mean anything: `resolveCardLayout` builds its object in one fixed
 * key order, so two layouts that describe the same card stringify identically
 * however they were assembled. A bare `JSON.stringify` on the pair would be key
 * order sensitive — and the pair here is a draft built by a dozen small edits
 * against a baseline that came back off the wire.
 *
 * The designer's Save button is what asks: it is the difference between a
 * button that is live because something changed and one that is live because a
 * key moved.
 */
export function sameCardLayout(a: CardLayout, b: CardLayout): boolean {
  return (
    JSON.stringify(resolveCardLayout(a)) === JSON.stringify(resolveCardLayout(b))
  );
}

/**
 * A fresh block id.
 *
 * Never reused, because the id is what a drag animates as it travels — two
 * blocks sharing one would swap places in the DOM mid-flight. It only has to be
 * unique within one card, which is a dozen blocks, so random is plenty and
 * `resolveCardLayout` de-duplicates anything that collides anyway.
 */
export function newCardBlockId(): string {
  return `b${Math.random().toString(36).slice(2, 10)}`;
}

/** Every zone, in render order. Re-exported so callers need one import. */
export { CARD_ZONES };
