import { DocsPane } from "@/components/layout/page-transition/docs-pane";

import { DocsNav } from "./docs-nav";

/**
 * The frame every docs page sits in.
 *
 * **Full width, not the header's `max-w-5xl`.** Centring the whole thing put the
 * nav rail about 210px in from the edge on a laptop, which read as a rail
 * floating in the middle of the page rather than one attached to its side. The
 * rail sits in the page's own gutter, the way the dashboard's does, behind a
 * hairline that runs the article's full height (the wrapper stretches; the
 * sticky list inside it does not), and the article takes the row beside it.
 *
 * Columns from Appwrite's docs: a 220px rail, a 44rem article, and from `xl`
 * a 208px "On this page". Stacked below `lg`. The nav goes *first* in the
 * source either way: stacked, "here is the set of guides" before "here is one of
 * them" is the right reading order, and it is the right tab order at both widths.
 */
export function DocsShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="w-full flex-1 px-4 py-8 sm:px-6 sm:py-12 lg:px-8">
      <div className="flex flex-col gap-8 lg:flex-row lg:gap-12">
        <div className="lg:w-55 lg:shrink-0 lg:border-r lg:border-border lg:pr-4">
          <DocsNav />
        </div>

        <DocsPane>{children}</DocsPane>
      </div>
    </div>
  );
}
