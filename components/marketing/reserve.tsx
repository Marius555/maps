/**
 * A box that is already the size of the largest thing it can hold.
 *
 * **It exists because this page centres its sections.** Every `screen` section
 * is `min-h-[100svh]` with `justify-center`, so a line of copy that grows by one
 * line moves everything above it by half a line — measured on the cost
 * calculator, dragging the slider through the crossover took the verdict from
 * 24px to 48px and shifted both cards 12px up, mid-drag. The same thing happens
 * sideways in a table: a cell counting up from `$0` to `$7,000` is narrower for
 * most of the count, and a column sized by its content moves while it runs.
 *
 * So the live content and every string it *could* be end up in one grid cell.
 * The cell is as tall and as wide as the longest of them, the visible one is
 * drawn in it, and nothing moves when it changes. `invisible` rather than
 * `hidden`: `visibility: hidden` still takes the space, which is the entire
 * point, and `aria-hidden` keeps the copies out of the accessibility tree.
 *
 * The sizers have to inherit the same type as the live text to measure the same,
 * which they do — the caller's font and measure sit on an ancestor (see
 * `CostSummary`, where this goes *inside* the `<p>` that carries them) rather
 * than on the visible child.
 */
export function Reserve({
  sizers,
  className = "",
  children,
}: {
  /** Everything the content can become, as text. */
  sizers: readonly string[];
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <span className={`grid ${className}`}>
      <span className="col-start-1 row-start-1">{children}</span>

      {[...new Set(sizers)].map((text) => (
        <span
          key={text}
          aria-hidden="true"
          className="invisible col-start-1 row-start-1"
        >
          {text}
        </span>
      ))}
    </span>
  );
}
