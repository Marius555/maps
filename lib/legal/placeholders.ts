/**
 * Filling a legal document's `{{path}}` placeholders, and telling whether what
 * is left is still a draft.
 *
 * Pure, so the rule that decides whether a contract may be shown in production
 * is tested rather than trusted.
 */

export type PlaceholderValues = Record<string, string | undefined>;

const PLACEHOLDER = /\{\{\s*([a-zA-Z][\w.]*)\s*\}\}/g;

/**
 * The markers `documents/legal/README.md` says must all be gone before a
 * document is published: an unconfirmed fact, and a sub-processor row that may
 * not apply.
 */
const DRAFT_MARKERS = /\[VERIFY\b|\[REMOVE IF UNUSED\]|\[IF USED\]/g;

export type FilledDocument = {
  text: string;
  /** Placeholder paths with no value, each once, in order of first use. */
  unfilled: string[];
  /** How many `[VERIFY …]`, `[REMOVE IF UNUSED]` and `[IF USED]` remain. */
  markerCount: number;
  /** True while anything above is left: the document must not go public. */
  isDraft: boolean;
};

/**
 * Replace every placeholder that has a value. One without a value — absent, or
 * blank after trimming — stays in the text exactly as written, so a reader of
 * a draft sees what is missing instead of a sentence with a hole in it.
 */
export function fillPlaceholders(
  markdown: string,
  values: PlaceholderValues,
): FilledDocument {
  const unfilled = new Set<string>();

  const text = markdown.replace(PLACEHOLDER, (match, path: string) => {
    const value = values[path]?.trim();
    if (value) return value;
    unfilled.add(path);
    return match;
  });

  const markerCount = text.match(DRAFT_MARKERS)?.length ?? 0;

  return {
    text,
    unfilled: [...unfilled],
    markerCount,
    isDraft: unfilled.size > 0 || markerCount > 0,
  };
}
