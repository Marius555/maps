import { CARD_ZONES, type CardBlock, type CardLayout } from "./card-layout";

/**
 * How one location's card differs from the account's own design.
 *
 * The design is saved once per account (lib/repositories/card-design.repository.ts)
 * and drawn for every location on every map, which is the right default and the
 * wrong answer for a flagship store that should show its logo where the rest show
 * a pin. This is the seam between the two, and it is deliberately narrow: it can
 * change what a block *is*, and it can change nothing else. Which blocks a card
 * has, which zone each sits in and what order they come in stay account-wide, so
 * the design somebody arranged still describes every card on the map.
 *
 * **An entry is a whole resolved block, not a diff.** Absent is meaningful all
 * over `CardBlock` -- no `logoMode` is the pin, no `fit` is Fill, no `bold` is
 * not bold, no `align` is left -- so a diff would have to carry a second list of
 * fields to unset, and all three renderers would have to apply both halves. A
 * resolved block reduces the whole merge to `overrides[block.id] ?? block`, which
 * is what makes this affordable in the embed (CLAUDE.md sections 2 and 4).
 *
 * The consequence is worth knowing and is what the card's Reset button exists
 * for: a block that has been singled out stops following the account design *for
 * that block*. Every other block on that pin, and every other pin, still does.
 */
export type CardBlockOverrides = Record<string, CardBlock>;

/**
 * The block as this location draws it: its own, or the design's.
 *
 * **A block at a time rather than a whole layout, and that is a budget
 * decision.** Both renderers already walk a zone's blocks one by one, so this is
 * everything either of them needs -- and rebuilding all three zones into a new
 * layout object cost the embed sixty bytes it does not have (CLAUDE.md §4). It
 * also runs on the pairing's own input, which is what keeps the rule below true.
 *
 * It must be applied **before `cardRows`**: a width or an overlap decides how
 * blocks pair into lines, so overriding after the pairing would draw a line the
 * pairing never agreed to.
 *
 * Two rules narrow what an override may do, and both are here rather than at the
 * call sites because all three renderers need the same answer:
 *
 *   - **An id the design no longer has is ignored** -- it simply never matches a
 *     block. Nothing sweeps an override when its block is deleted in the studio,
 *     for the reason nothing sweeps a deleted tag off the places wearing it:
 *     dangling ids are the normal state, and narrowing them away where they are
 *     read costs nothing.
 *   - **A type mismatch is ignored too.** Block ids are only unique within one
 *     card, and a design that deleted a Logo and later minted a block that
 *     happened to reuse the id must not inherit the old one's settings.
 *
 * The entry's own `id` is not read at all: it is normalised to the key it is
 * stored under on the way in (`readCardBlocks`) and on the way out
 * (`publishedCardBlocks`), so nothing here has to spend an allocation per block
 * defending against a blob that disagrees with itself.
 */
export function overrideBlock(
  block: CardBlock,
  overrides: CardBlockOverrides | null | undefined,
): CardBlock {
  const override = overrides?.[block.id];

  return override && override.type === block.type ? override : block;
}

/**
 * The whole layout as this location draws it.
 *
 * `overrideBlock` across every zone. Only `buildSnapshot` wants this -- it
 * resolves the merged card to clamp what it is about to publish, and clamping is
 * a question about the layout rather than about one block. The embed never
 * imports it, so it costs a visitor nothing.
 */
export function mergeCardBlocks(
  layout: CardLayout,
  overrides: CardBlockOverrides | null | undefined,
): CardLayout {
  if (!overrides) return layout;

  const zones = {} as CardLayout["zones"];

  for (const zone of CARD_ZONES) {
    zones[zone] = layout.zones[zone].map((block) =>
      overrideBlock(block, overrides),
    );
  }

  return { ...layout, zones };
}

/** Whether this location has singled anything out at all. */
export function hasCardBlockOverrides(
  overrides: CardBlockOverrides | null | undefined,
): boolean {
  return overrides !== null && overrides !== undefined &&
    Object.keys(overrides).length > 0;
}
