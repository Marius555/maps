import { formatPercent } from "@/lib/admin/format";
import type { Slice } from "@/lib/admin/metrics/users";
import { formatCount } from "@/lib/format/number";

/**
 * A part-to-whole as one segmented bar, with a legend naming every part, its
 * count and its share — so no part is known by colour alone.
 *
 * It replaces a donut per split. Three donuts took three cards and a row of
 * page to say what three bars say in one card, and the eye compares lengths
 * along one line far better than it compares arcs across three circles.
 *
 * `detail` is an optional extra figure per part (a plan's revenue), shown after
 * the share in the legend.
 *
 * A split with nothing in it is not drawn; `hasSlices` lets a card holding
 * several decide whether it has anything left to show.
 */
export function SplitBar({
  title,
  slices,
  detail,
}: {
  title: string;
  slices: Slice[];
  detail?: (slice: Slice) => string | null;
}) {
  const total = slices.reduce((sum, slice) => sum + slice.value, 0);
  if (total === 0) return null;

  const summary = slices
    .map((slice) => `${slice.label} ${formatCount(slice.value)}`)
    .join(", ");

  return (
    <div className="min-w-0 space-y-2.5">
      <div className="flex items-baseline justify-between gap-3">
        <h3 className="text-sm font-medium text-foreground">{title}</h3>
        <span className="text-xs tabular-nums text-muted">{formatCount(total)}</span>
      </div>

      <div
        role="img"
        aria-label={`${title}: ${summary}`}
        className="flex h-3 gap-0.5 overflow-hidden rounded-full bg-default"
      >
        {slices
          .filter((slice) => slice.value > 0)
          .map((slice) => (
            <div
              key={slice.key}
              className="h-full first:rounded-l-full last:rounded-r-full"
              style={{ flexGrow: slice.value, flexBasis: 0, background: slice.color }}
            />
          ))}
      </div>

      <ul className="flex flex-wrap gap-x-4 gap-y-1 text-xs">
        {slices.map((slice) => {
          const extra = detail?.(slice);

          return (
            <li key={slice.key} className="flex items-center gap-1.5">
              <span
                aria-hidden="true"
                className="size-2 shrink-0 rounded-full"
                style={{ background: slice.color }}
              />
              <span className="text-muted">{slice.label}</span>
              <span className="font-medium tabular-nums text-foreground">
                {formatCount(slice.value)}
              </span>
              <span className="tabular-nums text-muted">
                {formatPercent(slice.value / total)}
              </span>
              {extra ? <span className="tabular-nums text-muted">· {extra}</span> : null}
            </li>
          );
        })}
      </ul>
    </div>
  );
}

export function hasSlices(slices: Slice[]): boolean {
  return slices.some((slice) => slice.value > 0);
}
