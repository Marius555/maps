/**
 * The page's `<h1>`, for screen readers only.
 *
 * Every dashboard page used to print its title and a sentence under it, and every
 * one of them repeated what the chrome already said — "Locations" under the map's
 * name in the sidebar, "Publish", "Settings", "Maps". Two answers to "where am I"
 * on one screen, the second costing a band of vertical space above the thing you
 * actually came for. The sentences went the same way: a subtitle nobody reads
 * twice is decoration.
 *
 * The heading itself still has to exist. The sidebar's active item is `aria-current`
 * inside a nav landmark, which is orientation, not a document title, and a page
 * whose only headings are its panels' `<h2>`s has an outline that starts at level
 * two. So the title stays and stops being drawn.
 *
 * Anything the header used to carry on its right — a count, a primary action —
 * belongs with the controls it sits beside, not with a title. See
 * `places-toolbar.tsx` and `map-list.tsx` for where those went.
 */
export function PageTitle({ children }: { children: string }) {
  return <h1 className="sr-only">{children}</h1>;
}
