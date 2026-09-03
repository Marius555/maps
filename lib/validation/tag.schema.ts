import { z } from "zod";

import { hexColorSchema, idSchema } from "./common";
import { DEFAULT_PALETTE_COLOR } from "./palette";

/**
 * Tags: the map's one filter axis, and the thing that colours its pins.
 *
 * This used to be the *second* axis, beside categories — one category per
 * location because it coloured the pin, and any number of colourless tags for
 * everything else. Two vocabularies asking the same question under two names, on
 * one screen, and the one an owner reached for first was the one that took a
 * single value. Categories were merged into this in favour of the more capable
 * shape: **a tag carries a colour, and a location wears as many as apply.**
 *
 * The pin takes the colour of the location's **first** tag, which is why
 * `placeTagsSchema` preserves order and why nothing may sort a place's tags on
 * the way to storage or the snapshot.
 *
 * Tags live in **groups**, and the grouping is not decoration: a group is one
 * question, and the embed reads the groups as AND and the tags inside one as OR
 * (embed/src/filters.ts). "Sells bikes OR sells skis, AND is open Sundays" is
 * the shape of a real search; one flat list of chips cannot express it.
 */

/**
 * A group is a question, and a visitor scanning more than a handful of questions
 * has stopped filtering and started working. Tags per group is wider because one
 * question can genuinely have twenty answers — a product range does.
 */
export const MAX_TAG_GROUPS = 6;
export const MAX_TAGS_PER_GROUP = 24;
/**
 * Across all groups. Every tag a published place wears is bytes in the snapshot
 * *and* a chip in the filter row, so the ceiling is lower than 6 × 24 suggests.
 */
export const MAX_TAGS_TOTAL = 60;
/** One place. Beyond this the filters stop narrowing anything. */
export const MAX_TAGS_PER_PLACE = 20;

const labelSchema = z
  .string()
  .trim()
  .min(1, "Give it a name.")
  .max(64, "Keep the name under 64 characters.");

export const tagSchema = z.object({
  /** Stable across renames — places reference this, not the label. */
  id: idSchema,
  label: labelSchema,
  /**
   * The chip's colour, and the pin's when this is the location's first tag.
   *
   * Defaulted rather than required: every tag written before the merge with
   * categories has none, and a stored row must keep parsing. The default is the
   * palette's first colour, not a grey — a tag with no colour still has to be
   * tellable from its neighbours in a legend.
   */
  color: hexColorSchema.default(DEFAULT_PALETTE_COLOR),
});

export const tagGroupSchema = z.object({
  id: idSchema,
  label: labelSchema,
  tags: z
    .array(tagSchema)
    .max(MAX_TAGS_PER_GROUP, `A group can hold up to ${MAX_TAGS_PER_GROUP} tags.`)
    .refine(
      (tags) => new Set(tags.map((tag) => tag.label.toLowerCase())).size === tags.length,
      "Two tags in this group have the same name. Give each one a distinct name.",
    ),
});

export const tagGroupsSchema = z
  .array(tagGroupSchema)
  .max(MAX_TAG_GROUPS, `You can have up to ${MAX_TAG_GROUPS} filter groups.`)
  .refine(
    (groups) => new Set(groups.map((group) => group.id)).size === groups.length,
    "Two groups share an id.",
  )
  .refine(
    (groups) =>
      new Set(groups.map((group) => group.label.toLowerCase())).size === groups.length,
    "Two groups have the same name. Give each one a distinct name.",
  )
  .refine(
    (groups) => countTags(groups) <= MAX_TAGS_TOTAL,
    `You can have up to ${MAX_TAGS_TOTAL} tags across all groups.`,
  )
  /*
   * Ids are unique across every group, not just within one. A place stores bare
   * tag ids with no idea which group they came from, so two groups sharing an id
   * would make one place's tag match both questions at once — and the AND across
   * groups would then be satisfied by a single chip.
   */
  .refine((groups) => {
    const ids = groups.flatMap((group) => group.tags.map((tag) => tag.id));
    return new Set(ids).size === ids.length;
  }, "Two tags share an id.");

/**
 * The ids a place wears.
 *
 * Not validated against the map's own tag list, on purpose, and for the same
 * reason `pinIconRefSchema` isn't: an id the map no longer defines has to read
 * as absent rather than block the save. Deleting a tag does not rewrite every
 * place that wore it — Appwrite has no array-remove, and rewriting 3,000 rows to
 * tidy up ids no visitor can see is not a trade worth making — so dangling ids
 * are the normal state, and `buildSnapshot` narrows them away at publish time.
 */
export const placeTagsSchema = z
  .array(z.string().trim().min(1).max(64))
  .max(MAX_TAGS_PER_PLACE, `A location can carry up to ${MAX_TAGS_PER_PLACE} tags.`)
  // Two of the same id is the same tag worn twice, which renders as one chip and
  // filters identically. Deduped rather than rejected: it is not a mistake the
  // user can see, so it is not one worth an error message.
  .transform((tags) => [...new Set(tags)]);

/**
 * A fresh id, never one that existed before.
 *
 * This lives here rather than in the editor because the *rule* lives here, and
 * it is load-bearing: since nothing clears a deleted tag off the places wearing
 * it, an id handed out twice would resurrect a tag onto locations nobody
 * assigned it to. That is the bug the `pinIcons` cleanup in maps.repository.ts
 * exists to prevent; random ids prevent it without any cleanup at all.
 *
 * Never derive one from an index or a label.
 *
 * The one id in the system that breaks the "fresh" rule is a migrated category:
 * `scripts/migrate-categories-to-tags.mjs` mints its tag with the category's own
 * `cat-` id, so `places.category` folds into `places.tags` with no remapping.
 * That is safe only because categories are retired — nothing will ever hand out
 * a `cat-` id again, so it cannot collide with anything, past or future.
 */
export function newTagId(): string {
  return `tag-${crypto.randomUUID().slice(0, 8)}`;
}

export function newTagGroupId(): string {
  return `grp-${crypto.randomUUID().slice(0, 8)}`;
}

function countTags(groups: readonly { tags: readonly unknown[] }[]): number {
  return groups.reduce((total, group) => total + group.tags.length, 0);
}

export type TagInput = z.infer<typeof tagSchema>;
export type TagGroupInput = z.infer<typeof tagGroupSchema>;
