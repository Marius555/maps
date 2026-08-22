import type { MapTagGroup } from "@/lib/repositories/types";
import {
  MAX_TAGS_PER_GROUP,
  MAX_TAGS_TOTAL,
  MAX_TAG_GROUPS,
  newTagGroupId,
  newTagId,
} from "@/lib/validation/tag.schema";

import { normalizeLabel } from "./resolve-categories";

/**
 * Turns the tag text in a file into real tags.
 *
 * The sibling of `resolve-categories.ts` and deliberately shaped like it: places
 * store tag *ids*, a file only ever has labels, so an import has to reconcile
 * them — match an existing tag case-insensitively, or create one.
 *
 * Two things are genuinely different, and both matter.
 *
 * **Ids are random, not slugs.** `resolveCategories` derives a readable id from
 * the label, which is safe there because deleting a category sweeps it off every
 * place that used it (`clearFromPlaces`). Nothing sweeps tags — there is no
 * array-remove in Appwrite — so a label-derived id would let "Bikes", deleted and
 * later re-imported, come back attached to locations nobody tagged. That is the
 * resurrection bug `newTagId` exists to prevent.
 *
 * **A tag needs a group.** Existing labels resolve to whichever group already
 * holds them, wherever that is. New ones land together in a group named after
 * the column heading — one place to find them, and one place to drag them out of
 * in Settings once the owner decides what the questions really are.
 */

/** Where imported tags go when the map has nowhere for them yet. */
export const IMPORTED_TAG_GROUP_LABEL = "Tags";

export type ResolvedTags = {
  /** The map's full tag vocabulary after the import: existing plus new. */
  tagGroups: MapTagGroup[];
  /** How many tags were created, so the import can say what it added. */
  addedCount: number;
  /** Normalised label → tag id, for stamping onto each draft. */
  idByLabel: Map<string, string>;
  /** Labels dropped because the map is already at its ceiling. */
  dropped: string[];
};

/**
 * One cell, split into labels.
 *
 * Comma, semicolon and pipe, because real exports use all three and a file that
 * picked one is not a file we get to choose. Whitespace-only fragments and
 * repeats within a cell are dropped: `"Bikes, ,bikes"` is one tag.
 */
export function splitTagCell(value: string): string[] {
  const seen = new Set<string>();
  const labels: string[] = [];

  for (const part of value.split(/[,;|]/)) {
    const trimmed = part.trim();
    if (!trimmed) continue;

    const key = normalizeLabel(trimmed);
    if (seen.has(key)) continue;

    seen.add(key);
    labels.push(trimmed);
  }

  return labels;
}

export function resolveTags(
  labels: string[],
  existing: MapTagGroup[],
  groupLabel: string = IMPORTED_TAG_GROUP_LABEL,
): ResolvedTags {
  const idByLabel = new Map<string, string>();

  for (const group of existing) {
    for (const tag of group.tags) {
      // First wins. A label appearing in two groups is already a map the owner
      // has to sort out; picking the earlier one at least makes the import
      // repeatable rather than dependent on iteration luck.
      const key = normalizeLabel(tag.label);
      if (!idByLabel.has(key)) idByLabel.set(key, tag.id);
    }
  }

  const tagGroups = existing.map((group) => ({ ...group, tags: [...group.tags] }));
  const dropped: string[] = [];
  let addedCount = 0;
  let total = countTags(tagGroups);

  /** The group new tags go into. Resolved lazily so a fully-matched import adds nothing. */
  let target: MapTagGroup | null = null;

  const resolveTarget = (): MapTagGroup | null => {
    if (target) return target;

    const wanted = normalizeLabel(groupLabel) || normalizeLabel(IMPORTED_TAG_GROUP_LABEL);
    const found = tagGroups.find((group) => normalizeLabel(group.label) === wanted);

    if (found) {
      target = found;
      return target;
    }

    // No room for another question. Reported rather than silently ignored — the
    // user decides whether to import these rows untagged.
    if (tagGroups.length >= MAX_TAG_GROUPS) return null;

    target = {
      id: newTagGroupId(),
      label: groupLabel.trim().slice(0, 64) || IMPORTED_TAG_GROUP_LABEL,
      tags: [],
    };

    tagGroups.push(target);
    return target;
  };

  for (const label of labels) {
    const trimmed = label.trim();
    if (!trimmed) continue;

    const key = normalizeLabel(trimmed);
    if (idByLabel.has(key)) continue;

    const group = resolveTarget();

    if (
      !group ||
      total >= MAX_TAGS_TOTAL ||
      group.tags.length >= MAX_TAGS_PER_GROUP
    ) {
      if (!dropped.includes(trimmed)) dropped.push(trimmed);
      continue;
    }

    const tag = { id: newTagId(), label: trimmed.slice(0, 64) };

    group.tags.push(tag);
    idByLabel.set(key, tag.id);
    addedCount += 1;
    total += 1;
  }

  return { tagGroups, addedCount, idByLabel, dropped };
}

function countTags(groups: readonly { tags: readonly unknown[] }[]): number {
  return groups.reduce((total, group) => total + group.tags.length, 0);
}
