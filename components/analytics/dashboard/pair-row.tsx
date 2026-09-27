import type { ReactNode } from "react";

/**
 * A wide card and a narrow one on a row — two thirds and one third at `lg`.
 *
 * **When the narrow card has nothing to show, the wide one takes the row.**
 * The page used to work that out per panel, with a ternary of `col-span`s on
 * every card; it is one rule, so it lives here once. Each side is wrapped in a
 * one-cell grid so the card stretches to the row's height: two cards side by
 * side that end at different heights read as a layout mistake.
 */
export function PairRow({ main, side }: { main: ReactNode; side: ReactNode }) {
  return (
    <div className="grid gap-4 lg:grid-cols-3">
      <div className={`grid min-w-0 ${side ? "lg:col-span-2" : "lg:col-span-3"}`}>
        {main}
      </div>
      {side ? <div className="grid min-w-0">{side}</div> : null}
    </div>
  );
}
