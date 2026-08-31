import { z } from "zod";

import {
  CARD_BLOCKS,
  CARD_ZONES,
  MAX_BLOCK_MARGIN,
  MAX_BLOCK_OFFSET,
  MAX_BLOCK_PADDING,
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

const cardBlockSchema = z.object({
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
    background: z.string().regex(/^#(?:[0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/).optional(),
    border: z.string().regex(/^#(?:[0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/).optional(),
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
