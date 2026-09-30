import { formatCount } from "@/lib/format/number";

export type LegendItem = {
  key: string;
  label: string;
  color: string;
  total?: number;
  /** A dashed key — the previous period's ghost line. */
  dashed?: boolean;
};

/**
 * The legend above a chart, in HTML: a key, the series' name and its total for
 * the period. The name keeps colour from being the only thing that says which
 * series is which.
 *
 * **One line, never wrapping** — it sits in a fixed-height row so a panel with
 * four series is exactly as tall as one with one; on a narrow card it scrolls
 * sideways. Hovering an item highlights its series when `onHighlight` is given.
 */
export function SeriesLegend({
  items,
  highlight = null,
  onHighlight,
}: {
  items: LegendItem[];
  highlight?: string | null;
  onHighlight?: (key: string | null) => void;
}) {
  return (
    <ul className="flex min-w-0 items-center gap-x-4 overflow-x-auto text-xs whitespace-nowrap [scrollbar-width:none]">
      {items.map((item) => (
        <li
          key={item.key}
          className="flex shrink-0 items-center gap-1.5 transition-opacity motion-reduce:transition-none"
          style={{ opacity: highlight && highlight !== item.key ? 0.45 : 1 }}
          onMouseEnter={onHighlight ? () => onHighlight(item.key) : undefined}
          onMouseLeave={onHighlight ? () => onHighlight(null) : undefined}
        >
          {item.dashed ? (
            <span
              aria-hidden="true"
              className="w-3.5 shrink-0 border-t-2 border-dashed"
              style={{ borderColor: item.color }}
            />
          ) : (
            <span
              aria-hidden="true"
              className="size-2.5 shrink-0 rounded-sm"
              style={{ background: item.color }}
            />
          )}
          <span className="text-muted">{item.label}</span>
          {item.total !== undefined ? (
            <span className="font-medium tabular-nums text-foreground">{formatCount(item.total)}</span>
          ) : null}
        </li>
      ))}
    </ul>
  );
}
