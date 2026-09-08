/**
 * How big a number is against the thing it is part of.
 *
 * A bar and not a percentage, because the question this column answers is
 * "roughly how much" and the eye reads a length faster than it reads "80.3%"
 * — and because a column of lengths can be scanned down in one pass, which is
 * the whole reason these numbers are in a table rather than on cards.
 *
 * `aria-hidden`, deliberately. It is a second drawing of the number already in
 * the cell beside it, so announcing it would read every row twice. The exact
 * figure is the accessible one.
 *
 * Zero still draws its track. An empty cell reads as "no data"; an empty track
 * reads as "none of them", which is what it means.
 */
export function StatBar({ share }: { share: number }) {
  // A hairline for a share too small to see, so "3 of 3,000" is not drawn
  // identically to "0 of 3,000".
  const width = share > 0 ? Math.max(share * 100, 1.5) : 0;

  return (
    <span
      aria-hidden="true"
      className="block h-1.5 w-full max-w-24 overflow-hidden rounded-full bg-default"
    >
      <span
        className="block h-full rounded-full bg-accent"
        style={{ width: `${width}%` }}
      />
    </span>
  );
}
