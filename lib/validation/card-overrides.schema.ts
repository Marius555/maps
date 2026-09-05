import { z } from "zod";

import type { CardBlockOverrides } from "@/packages/shared/card-overrides";
import { cardBlockSchema } from "./card-layout.schema";

/**
 * What a location may say about its own card.
 *
 * `{ [blockId]: CardBlock }` — the same block shape the designer saves, keyed by
 * the id of the block in the account's design that it stands in for. See
 * `mergeCardBlocks` (packages/shared/card-overrides.ts) for why an entry is a
 * whole block rather than a diff against the design.
 *
 * **Shape here, rules at publish.** This is what turns a malformed body into a
 * 422 rather than a 500, exactly as `cardLayoutSchema` does for the design. What
 * it deliberately does *not* do is resolve each entry against the design: the
 * rules a block is held to — which zone it may sit in, how wide it may be, what
 * an unset margin falls back to — are all questions about the layout it lives
 * in, and this schema has no access to it. The two places that do are the client,
 * which produces every value by round-tripping through `resizeCardBlock`, and
 * `buildSnapshot`, which resolves the merged layout before writing a file that
 * customer sites read forever (CLAUDE.md §7). A row hand-edited past both draws
 * its owner a wrong card on their own dashboard, and nothing else.
 *
 * The ceiling is the same bound `MAX_BLOCKS_PER_ZONE` puts on a design, times the
 * three zones: an override per block on the card is the most that can ever mean
 * anything, and anything past it is a column being used as storage.
 */
const MAX_OVERRIDDEN_BLOCKS = 72;

export const cardBlocksSchema = z
  .record(z.string().min(1).max(64), cardBlockSchema)
  .refine(
    (value) => Object.keys(value).length <= MAX_OVERRIDDEN_BLOCKS,
    `A card cannot single out more than ${String(MAX_OVERRIDDEN_BLOCKS)} blocks.`,
  )
  .transform((value): CardBlockOverrides => value as CardBlockOverrides);

/**
 * The stored blob as something drawable.
 *
 * `readCardLayout`'s contract one level down, and it has to hold for the same
 * reason: the column is free-form JSON that may have been written by an older
 * build or left empty by every location created before this existed. Never
 * throws — an unreadable entry is dropped and the block falls back to the
 * account's design, which is the answer that was right before anybody singled it
 * out.
 */
export function readCardBlocks(value: unknown): CardBlockOverrides {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};

  const out: CardBlockOverrides = {};

  // Entry by entry, rather than one `safeParse` of the whole record: a single
  // unreadable block would otherwise take every other override on the card down
  // with it, and the one that is wrong is the one worth losing.
  for (const [id, raw] of Object.entries(value as Record<string, unknown>)) {
    if (Object.keys(out).length >= MAX_OVERRIDDEN_BLOCKS) break;

    const parsed = cardBlockSchema.safeParse(raw);
    // The id is normalised to the key it is stored under, here and in
    // `publishedCardBlocks`, so `overrideBlock` never has to defend against a
    // blob whose entry disagrees with its own key -- which on a card drawn per
    // pin would be an allocation per block, per popup.
    if (parsed.success) {
      out[id] = { ...parsed.data, id } as CardBlockOverrides[string];
    }
  }

  return out;
}
