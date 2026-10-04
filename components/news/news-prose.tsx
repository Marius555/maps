/**
 * The typography of a news post's body: a serif reading column with underlined
 * links, headings back in the sans.
 *
 * Same approach as `components/legal/legal-article.tsx`: no typography plugin
 * (Tailwind here is CSS-first with no config, CLAUDE.md §3), so element styles
 * are descendant variants set once.
 */
export function NewsProse({ children }: { children: React.ReactNode }) {
  return (
    <div
      className={[
        "min-w-0 space-y-6 font-serif text-[1.0625rem]/[1.75] text-foreground",
        "[&_h1]:pt-6 [&_h1]:font-sans [&_h1]:text-3xl [&_h1]:font-semibold [&_h1]:tracking-tight [&_h1]:text-balance",
        "[&_h2]:pt-6 [&_h2]:font-sans [&_h2]:text-2xl [&_h2]:font-semibold [&_h2]:tracking-tight [&_h2]:text-balance",
        "[&_h3]:pt-3 [&_h3]:font-sans [&_h3]:text-xl [&_h3]:font-semibold",
        "[&_p]:text-pretty",
        "[&_strong]:font-semibold",
        "[&_a]:underline [&_a]:decoration-1 [&_a]:underline-offset-[3px] [&_a]:break-words [&_a:hover]:text-accent",
        "[&_ul]:space-y-2 [&_ul]:list-disc [&_ul]:pl-6 [&_ul]:marker:text-muted",
        "[&_ol]:space-y-2 [&_ol]:list-decimal [&_ol]:pl-6 [&_ol]:marker:text-muted",
        "[&_li>ul]:pt-2 [&_li>ol]:pt-2",
        "[&_hr]:my-12 [&_hr]:border-border",
        "[&_blockquote]:border-l-2 [&_blockquote]:border-foreground [&_blockquote]:pl-5 [&_blockquote]:italic",
        "[&_img]:w-full [&_img]:rounded-2xl",
        "[&_table]:font-sans",
        "[&_code]:rounded-md [&_code]:bg-default [&_code]:px-1.5 [&_code]:py-0.5 [&_code]:font-mono [&_code]:text-sm",
        "[&_pre]:overflow-x-auto [&_pre]:rounded-xl [&_pre]:bg-default [&_pre]:p-4 [&_pre_code]:bg-transparent [&_pre_code]:p-0",
      ].join(" ")}
    >
      {children}
    </div>
  );
}
