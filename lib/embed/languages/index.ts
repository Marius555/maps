import {
  EMBED_STRINGS,
  EMBED_STRING_KEYS,
  type EmbedStringKey,
  type EmbedStrings,
} from "@/packages/shared/embed-strings";

import { DE } from "./de";
import { EN } from "./en";
import { ES } from "./es";
import { FR } from "./fr";
import { LT } from "./lt";
import type { EmbedLanguage } from "./types";

export type { EmbedLanguage } from "./types";

/**
 * The languages a published map can speak, English first.
 *
 * Dashboard only. Whatever sits in /packages/shared ships to every visitor, so
 * the presets live here and publish writes the one table a map needs into its
 * snapshot — a French map never downloads a word of German.
 */
export const EMBED_LANGUAGES = [EN, LT, DE, FR, ES] as const satisfies readonly EmbedLanguage[];

export const EMBED_LANGUAGE_IDS = EMBED_LANGUAGES.map((language) => language.id) as [
  string,
  ...string[],
];

export const DEFAULT_EMBED_LANGUAGE = EN.id;

export function embedLanguage(id: string): EmbedLanguage {
  return EMBED_LANGUAGES.find((language) => language.id === id) ?? EN;
}

export type ResolvedEmbedWords = {
  /** Absent for English, which is what the embed reads a missing `lang` as. */
  lang?: string;
  /** Only the words that differ from English; absent when none do. */
  strings?: EmbedStrings;
  /** The badge text in this language, brand name filled in. */
  badge: string;
};

/**
 * What a snapshot carries for a map in `languageId` with the owner's own edits.
 *
 * The preset, the owner's words laid over it, then every value equal to the
 * English default dropped — so an English map with no edits publishes neither
 * field and reads exactly as a map published before languages existed (§7),
 * and an edit that happens to say the default costs no bytes.
 */
export function resolveEmbedWords(
  languageId: string,
  overrides: EmbedStrings,
  brand: string,
): ResolvedEmbedWords {
  const language = embedLanguage(languageId);
  const strings: EmbedStrings = {};

  for (const key of EMBED_STRING_KEYS) {
    const own = overrides[key]?.trim();
    const word = own || language.strings[key];

    if (word !== EMBED_STRINGS[key]) strings[key] = word;
  }

  return {
    ...(language.id === EN.id ? {} : { lang: language.id }),
    ...(Object.keys(strings).length > 0 ? { strings } : {}),
    badge: language.badge.replace("{brand}", brand),
  };
}

/**
 * What the wording dialog shows: every phrase as a visitor would read it — the
 * owner's own word where they wrote one, the language's where they did not.
 */
export function wordingValues(
  languageId: string,
  overrides: EmbedStrings,
): Record<EmbedStringKey, string> {
  const language = embedLanguage(languageId);

  return Object.fromEntries(
    EMBED_STRING_KEYS.map((key) => [key, overrides[key] ?? language.strings[key]]),
  ) as Record<EmbedStringKey, string>;
}

/**
 * The reverse: only the phrases the owner actually changed. A field left as the
 * language says it, or emptied, is not an edit — so switching the language later
 * moves every phrase the owner did not touch along with it.
 */
export function wordingOverrides(
  languageId: string,
  values: Record<EmbedStringKey, string>,
): EmbedStrings {
  const language = embedLanguage(languageId);
  const overrides: EmbedStrings = {};

  for (const key of EMBED_STRING_KEYS) {
    const word = values[key]?.trim();
    if (word && word !== language.strings[key]) overrides[key] = word;
  }

  return overrides;
}
