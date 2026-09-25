/**
 * A reference table. The first cell of each row is the row's header — a term,
 * a plan, a message — and the cells after it say what it means.
 *
 * Most guides use two columns; a plan comparison needs four, so the column
 * count is whatever `head` says rather than a fixed pair.
 *
 * The scroller is the table's own wrapper, not the page. A table wider than a
 * phone that is allowed to widen the document gives the whole page a horizontal
 * scrollbar, and every other line on it then moves sideways under the reader's
 * thumb. `min-w-md` inside the scroller keeps the columns from collapsing into
 * one word per line instead of scrolling.
 */
export function DocsTable({
  caption,
  head,
  rows,
}: {
  caption: string;
  head: string[];
  rows: React.ReactNode[][];
}) {
  return (
    <div className="overflow-x-auto rounded-xl border border-border">
      <table className="w-full min-w-md border-collapse text-left text-sm">
        <caption className="sr-only">{caption}</caption>

        <thead>
          <tr className="border-b border-border">
            {head.map((cell) => (
              <th
                key={cell}
                scope="col"
                className="px-4 py-2.5 font-medium text-muted"
              >
                {cell}
              </th>
            ))}
          </tr>
        </thead>

        <tbody>
          {rows.map(([term, ...cells], index) => (
            <tr
              // The term is the row's identity — these lists are short, fixed
              // and written by hand, so there is no id to carry.
              key={index}
              className="border-b border-border last:border-b-0"
            >
              <th
                scope="row"
                className="px-4 py-3 align-top font-medium whitespace-nowrap text-foreground"
              >
                {term}
              </th>
              {cells.map((cell, cellIndex) => (
                <td
                  key={cellIndex}
                  className="px-4 py-3 align-top text-foreground"
                >
                  {cell}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
