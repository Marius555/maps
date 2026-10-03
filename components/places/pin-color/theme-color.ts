import type { MapTagGroup } from "@/lib/repositories/types";
import { pinColorOfTags } from "@/packages/shared/tags";

/**
 * What a location's pin is painted when it has no colour of its own — the
 * first swatch in its Pin colour picker, and what pressing that swatch goes
 * back to.
 *
 * The same order `groupColorIndex.forPlace` falls through once `place.color`
 * is empty: its group's (or its grouped route's), then its first tag's, then
 * the map's Default pin colour. A custom pin's own colour is left out on
 * purpose: it beats this *and* the location's own colour, so the picker says
 * so in words rather than offering a swatch that would change nothing.
 *
 * Plain module, no `"use client"` — see CLAUDE.md on client references.
 */
export function pinThemeColor({
  groupColor,
  tagGroups,
  tags,
  defaultPinColor,
}: {
  groupColor: string | undefined;
  tagGroups: readonly MapTagGroup[];
  tags: readonly string[];
  /** The map's Default pin colour, `readEmbedSettings(map.settings).pinColor`. */
  defaultPinColor: string;
}): string {
  return (groupColor ?? pinColorOfTags(tagGroups, tags) ?? defaultPinColor).toLowerCase();
}
