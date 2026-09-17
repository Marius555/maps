import "server-only";

import { readFile } from "node:fs/promises";
import path from "node:path";

import { LEGAL_DOCUMENTS, type LegalSlug } from "./documents";
import { type FilledDocument, fillPlaceholders } from "./placeholders";
import { legalPlaceholderValues } from "./values";

/**
 * One legal document, read from `documents/legal/` and filled in.
 *
 * Read with `fs` at render time, which for these pages is build time: they are
 * static, so the Markdown is baked into the HTML and the deployed site never
 * needs the `documents/` folder.
 */
export async function loadLegalDocument(slug: LegalSlug): Promise<FilledDocument> {
  const file = path.join(
    process.cwd(),
    "documents",
    "legal",
    LEGAL_DOCUMENTS[slug].file,
  );
  const markdown = await readFile(file, "utf8");
  return fillPlaceholders(markdown, legalPlaceholderValues());
}
