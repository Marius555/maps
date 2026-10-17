import { DocsNavList } from "./docs-nav-list";
import { DocsNavMobile } from "./docs-nav-mobile";

/**
 * The list of guides, beside the one you are reading.
 *
 * Two forms of one list (`DocsNavList`): from `lg` a sticky rail with a column
 * of its own, below it a disclosure above the article (`DocsNavMobile`). A
 * sticky rail on a phone is a rail covering the thing you came to read. Only one
 * is ever displayed, so only one "Documentation" landmark is in the tree.
 *
 * The rail scrolls on its own once it is taller than the window, so the last
 * group is never out of reach while the page is sticky.
 */
export function DocsNav() {
  return (
    <>
      <DocsNavMobile />

      <nav
        aria-label="Documentation"
        className="hidden lg:sticky lg:top-8 lg:block lg:max-h-[calc(100dvh-4rem)] lg:overflow-y-auto"
      >
        <DocsNavList idPrefix="docs-nav" />
      </nav>
    </>
  );
}
