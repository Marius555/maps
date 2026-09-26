import type { EmbedStringKey } from "@/packages/shared/embed-strings";

/**
 * One ready-made translation of everything the embed says.
 *
 * Complete by type — `Record`, not `Partial` — so adding a key to
 * `EMBED_STRINGS` fails the build until every preset says it too, rather than
 * shipping a German map with one English sentence in it.
 */
export type EmbedLanguage = {
  /** BCP 47. Also what the snapshot's `lang` carries. */
  id: string;
  /** In its own language, which is how people look for theirs in a list. */
  label: string;
  strings: Record<EmbedStringKey, string>;
  /** The badge on maps whose plan shows it. `{brand}` is brand.json's name. */
  badge: string;
};
