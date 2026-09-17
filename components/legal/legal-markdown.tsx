import { Children, isValidElement } from "react";
import type { Components } from "react-markdown";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

import { BrandLink } from "@/components/brand/brand-link";
import { BRAND } from "@/lib/brand";
import { headingSlug } from "@/lib/legal/slug";

/** The plain text of a heading's children, however they are nested. */
function textOf(node: React.ReactNode): string {
  return Children.toArray(node)
    .map((child) => {
      if (typeof child === "string" || typeof child === "number") {
        return String(child);
      }
      if (isValidElement<{ children?: React.ReactNode }>(child)) {
        return textOf(child.props.children);
      }
      return "";
    })
    .join("");
}

/**
 * The documents print their own addresses in full — "the Terms of Service at
 * https://pinglide.com/terms" — because they are read on paper too. On the site
 * those are our own pages, so they go through the router rather than opening a
 * second tab of the same site.
 */
function ownPath(href: string): string {
  const site = BRAND.website;
  if (!site) return href;
  if (href === site) return "/";
  if (href.startsWith(`${site}/`)) return href.slice(site.length);
  if (href.startsWith(`${site}#`)) return `/${href.slice(site.length)}`;
  return href;
}

const COMPONENTS: Components = {
  h2: ({ children }) => <h2 id={headingSlug(textOf(children))}>{children}</h2>,
  h3: ({ children }) => <h3 id={headingSlug(textOf(children))}>{children}</h3>,

  a: ({ href = "", children }) => {
    const target = ownPath(href);
    // In-page anchors and mail links are not brand links: neither navigates to
    // another site, and neither should open a tab.
    if (target.startsWith("#") || target.startsWith("mailto:")) {
      return <a href={target}>{children}</a>;
    }
    return <BrandLink href={target}>{children}</BrandLink>;
  },

  // Its own scroller, so a four-column table on a phone scrolls inside its box
  // instead of widening the page under every other line — docs-table.tsx's rule.
  table: ({ children }) => (
    <div className="overflow-x-auto rounded-xl border border-border">
      <table className="w-full min-w-xl border-collapse text-left text-sm">
        {children}
      </table>
    </div>
  ),
  tr: ({ children }) => (
    <tr className="border-b border-border last:border-b-0">{children}</tr>
  ),
  th: ({ children }) => (
    <th scope="col" className="px-4 py-2.5 align-top font-medium text-muted">
      {children}
    </th>
  ),
  td: ({ children }) => <td className="px-4 py-3 align-top">{children}</td>,
};

/** A filled legal document, as GitHub-flavoured Markdown. */
export function LegalMarkdown({ markdown }: { markdown: string }) {
  return (
    <ReactMarkdown remarkPlugins={[remarkGfm]} components={COMPONENTS}>
      {markdown}
    </ReactMarkdown>
  );
}
