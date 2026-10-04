import Link from "next/link";
import type { Components } from "react-markdown";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

/**
 * A news post's body, as GitHub-flavoured Markdown. docs/notes/news.md.
 *
 * Rendered on the public article and in the console's preview, so the two
 * cannot disagree. **Raw HTML stays off** (react-markdown's default, and no
 * `rehype-raw` here), and react-markdown's default `urlTransform` already drops
 * `javascript:` and other unsafe link targets — so a post can carry nothing a
 * Markdown link or image cannot.
 *
 * Same link and table handling as `components/legal/legal-markdown.tsx`: our own
 * paths go through the router, anything else opens in a new tab.
 */
const COMPONENTS: Components = {
  a: ({ href = "", children }) => {
    if (href.startsWith("/") && !href.startsWith("//")) {
      return <Link href={href}>{children}</Link>;
    }
    if (href.startsWith("#") || href.startsWith("mailto:")) {
      return <a href={href}>{children}</a>;
    }
    return (
      <a href={href} target="_blank" rel="noopener noreferrer">
        {children}
      </a>
    );
  },

  // A plain img: authors paste addresses from anywhere, which next/image would
  // need listing in the config one host at a time.
  img: ({ src, alt }) =>
    typeof src === "string" && src ? (
      // eslint-disable-next-line @next/next/no-img-element
      <img src={src} alt={alt ?? ""} loading="lazy" decoding="async" />
    ) : null,

  // Its own scroller, so a wide table on a phone scrolls inside its box instead
  // of widening the page.
  table: ({ children }) => (
    <div className="overflow-x-auto rounded-xl border border-border">
      <table className="w-full min-w-xl border-collapse text-left text-sm">{children}</table>
    </div>
  ),
  tr: ({ children }) => <tr className="border-b border-border last:border-b-0">{children}</tr>,
  th: ({ children }) => (
    <th scope="col" className="px-4 py-2.5 align-top font-medium text-muted">
      {children}
    </th>
  ),
  td: ({ children }) => <td className="px-4 py-3 align-top">{children}</td>,
};

export function NewsMarkdown({ markdown }: { markdown: string }) {
  return (
    <ReactMarkdown remarkPlugins={[remarkGfm]} components={COMPONENTS}>
      {markdown}
    </ReactMarkdown>
  );
}
