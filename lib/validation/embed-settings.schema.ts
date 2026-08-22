import { z } from "zod";

import type { SnapshotSettings } from "@/packages/shared/snapshot";

/**
 * Which of the embed's optional controls are switched on.
 *
 * These four gate real behaviour in the published embed — clustering, the search
 * field, the category chips and "find nearest". They were wired end to end from
 * the start but had no way in: `settings` was written once as `{}` at map
 * creation and never again, so every map shipped with all four on whether its
 * owner wanted them or not.
 *
 * The defaults and the reader live here rather than beside the snapshot
 * generator because the settings form needs exactly the same two, and a second
 * copy of "what does absent mean" is how the form and the published map start
 * disagreeing.
 */

export const DEFAULT_EMBED_SETTINGS: SnapshotSettings = {
  clustering: true,
  search: true,
  filters: true,
  nearest: true,
  // On by default: a store locator without a results list is the thing the list
  // was added to fix, and a new map should be one out of the box. This changes
  // nothing for a map already published — its live snapshot keeps the shape it
  // was written with, and only a republish opts it in.
  list: true,
};

export const embedSettingsSchema = z.object({
  clustering: z.boolean(),
  search: z.boolean(),
  filters: z.boolean(),
  nearest: z.boolean(),
  list: z.boolean(),
});

export type EmbedSettings = z.output<typeof embedSettingsSchema>;

/**
 * `settings` is a free-form JSON column that may have been written by an older
 * build or edited in the console, so every flag falls back to its default rather
 * than trusting the stored shape.
 */
export function readEmbedSettings(
  settings: Record<string, unknown>,
): SnapshotSettings {
  return {
    clustering: readFlag(settings.clustering, DEFAULT_EMBED_SETTINGS.clustering),
    search: readFlag(settings.search, DEFAULT_EMBED_SETTINGS.search),
    filters: readFlag(settings.filters, DEFAULT_EMBED_SETTINGS.filters),
    nearest: readFlag(settings.nearest, DEFAULT_EMBED_SETTINGS.nearest),
    list: readFlag(settings.list, DEFAULT_EMBED_SETTINGS.list ?? true),
  };
}

function readFlag(value: unknown, fallback: boolean): boolean {
  return typeof value === "boolean" ? value : fallback;
}
