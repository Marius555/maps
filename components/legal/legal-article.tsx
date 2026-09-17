/**
 * The typography of a legal document.
 *
 * Same approach as `components/docs/docs-article.tsx`: no typography plugin
 * (Tailwind here is CSS-first with no config, CLAUDE.md §3), so element styles
 * are descendant variants set once. The Markdown decides the structure, this
 * decides how it reads — a contract is long, so body copy is `text-foreground`
 * at a comfortable measure rather than `text-muted`.
 *
 * Tables are styled in `legal-markdown.tsx`, where each gets its own scroller.
 */
export function LegalArticle({ children }: { children: React.ReactNode }) {
  return (
    <article
      className={[
        "min-w-0 space-y-4 text-sm/6 text-foreground",
        "[&_h1]:text-2xl [&_h1]:font-semibold [&_h1]:tracking-tight [&_h1]:text-balance sm:[&_h1]:text-3xl",
        "[&_h2]:scroll-mt-8 [&_h2]:pt-8 [&_h2]:text-lg [&_h2]:font-semibold [&_h2]:tracking-tight",
        "[&_h3]:scroll-mt-8 [&_h3]:pt-4 [&_h3]:font-semibold",
        "[&_p]:text-pretty",
        "[&_strong]:font-semibold",
        "[&_a]:underline [&_a]:underline-offset-2 [&_a]:break-words [&_a:hover]:text-accent",
        "[&_ul]:space-y-2 [&_ul]:list-disc [&_ul]:pl-5 [&_ul]:marker:text-muted",
        "[&_ol]:space-y-2 [&_ol]:list-decimal [&_ol]:pl-5 [&_ol]:marker:text-muted",
        "[&_li>ul]:pt-2 [&_li>ol]:pt-2",
        "[&_hr]:my-8 [&_hr]:border-border",
        "[&_blockquote]:border-l-2 [&_blockquote]:border-border [&_blockquote]:pl-4 [&_blockquote]:text-muted",
        "[&_code]:rounded-md [&_code]:bg-default [&_code]:px-1.5 [&_code]:py-0.5 [&_code]:font-mono [&_code]:text-xs",
      ].join(" ")}
    >
      {children}
    </article>
  );
}
