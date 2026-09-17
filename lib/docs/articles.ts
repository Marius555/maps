import { Upload, type LucideIcon } from "lucide-react";

/**
 * Every guide there is, in the order they should be read.
 *
 * One list rather than a page each, because the hub's cards and the shell's nav
 * are two views of the same set and a second copy is how a guide ends up listed
 * in one and missing from the other. Adding a guide is an entry here plus a
 * `page.tsx` at the matching slug.
 *
 * `summary` is written to be read on its own: it is the card's body, the nav's
 * tooltip-less second line, and the page's `<meta name="description">`.
 */
export type DocsArticle = {
  /**the last segment of `/docs/<slug>`. */
  slug: string;
  title: string;
  summary: string;
  icon: LucideIcon;
};

export const DOCS_ARTICLES: DocsArticle[] = [
  {
    slug: "importing-locations",
    title: "Importing locations",
    summary:
      "Bring your locations in from a spreadsheet, an XML feed or a Google Sheet, and check where they landed before anything is saved.",
    icon: Upload,
  },
];

export function docsHref(slug: string): string {
  return `/docs/${slug}`;
}

export function findArticle(slug: string): DocsArticle | undefined {
  return DOCS_ARTICLES.find((article) => article.slug === slug);
}
