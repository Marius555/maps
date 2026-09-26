import {
  EMBED_STRINGS,
  type EmbedStringKey,
  type EmbedStrings,
} from "@/packages/shared/embed-strings";
import type { MapSnapshot } from "@/packages/shared/snapshot";

/**
 * The words this map speaks, set once per render from its snapshot.
 *
 * Module state rather than a table threaded through every builder, because the
 * strings are read in five files and a dozen places, and a parameter on each of
 * them would cost more bytes than the feature. The price is written down in
 * docs/notes/publish-and-embed.md: two maps on one page share one table, so a
 * page embedding an English map and a German one gets whichever rendered last.
 *
 * Absent `strings` is English, and absent `lang` is the English day names —
 * every snapshot published before languages existed reads as it always did.
 */
let table: EmbedStrings = {};

/** BCP 47, or undefined for English. Read by the hours block's day names. */
export let lang: string | undefined;

export function setStrings(snapshot: MapSnapshot): void {
  table = snapshot.strings ?? {};
  lang = snapshot.lang;
}

export const t = (key: EmbedStringKey): string => table[key] || EMBED_STRINGS[key];
