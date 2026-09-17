import { DocsNav } from "./docs-nav";

/**
 * The frame every docs page sits in.
 *
 * **Full width, not the header's `max-w-5xl`.** Centring the whole thing put the
 * nav rail about 210px in from the edge on a laptop, which read as a rail
 * floating in the middle of the page rather than one attached to its side. The
 * rail now sits in the page's own gutter, the way the dashboard's does, and the
 * article keeps its readable measure from `DocsArticle` instead of inheriting
 * one from a wrapper.
 *
 * Two columns from `lg`, stacked below. The nav goes *first* in the source
 * either way: stacked, "here is the set of guides" before "here is one of them"
 * is the right reading order, and it is the right tab order at both widths.
 */
export function DocsShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="w-full flex-1 px-4 py-8 sm:px-6 sm:py-12 lg:px-8">
      <div className="flex flex-col gap-8 lg:flex-row lg:gap-10">
        <div className="lg:w-40 lg:shrink-0">
          <DocsNav />
        </div>

        {children}
      </div>
    </div>
  );
}
