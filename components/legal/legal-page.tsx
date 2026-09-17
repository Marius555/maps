import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { LEGAL_DOCUMENTS, type LegalSlug } from "@/lib/legal/documents";
import { loadLegalDocument } from "@/lib/legal/load";
import { DraftNotice } from "./draft-notice";
import { LegalArticle } from "./legal-article";
import { LegalMarkdown } from "./legal-markdown";

export function legalMetadata(slug: LegalSlug): Metadata {
  const { title, summary } = LEGAL_DOCUMENTS[slug];
  return { title, description: summary };
}

/**
 * One legal document as a public page.
 *
 * **A draft never reaches production.** The documents name a company as the
 * party customers contract with, and published with blanks in them — or before
 * that company exists — they bind the person running the service instead
 * (`documents/legal/README.md`). So while any placeholder or `[VERIFY]` marker
 * is left, a production build answers 404, and development draws the page with
 * a notice listing what is missing.
 *
 * Nothing links here until `brand.json`'s `legal` URLs are set, which is the
 * last step of publishing.
 */
export async function LegalPage({ slug }: { slug: LegalSlug }) {
  const doc = await loadLegalDocument(slug);

  if (doc.isDraft && process.env.NODE_ENV === "production") notFound();

  return (
    <div className="mx-auto w-full max-w-3xl space-y-8 px-4 py-8 sm:px-6 sm:py-12">
      {doc.isDraft && (
        <DraftNotice unfilled={doc.unfilled} markerCount={doc.markerCount} />
      )}

      <LegalArticle>
        <LegalMarkdown markdown={doc.text} />
      </LegalArticle>
    </div>
  );
}
