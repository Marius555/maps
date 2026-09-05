/**
 * The one page that takes the nav's place instead of sitting beside it.
 *
 * `/maps/[id]/publish` is the map designer: a full-height column of controls on
 * the left and the customer's own map filling everything else. That column *is*
 * the sidebar on this page — two of them, one above the other in the same 15rem
 * of screen, would be a designer asking the owner to choose between navigating
 * and designing every time they look left.
 *
 * A predicate rather than a check written into the sidebar, so the rule has one
 * home and anything else that needs to know (a skeleton, a future full-bleed
 * page) asks the same question.
 *
 * **Only the desktop rail.** `MobileHeader` and its drawer are the only way out
 * of any page below `md`, and they are untouched — the designer stacks there
 * rather than taking a column, so there is nothing for it to replace.
 */
export function hidesAppNav(pathname: string): boolean {
  return /^\/maps\/[^/]+\/publish\/?$/.test(pathname);
}
