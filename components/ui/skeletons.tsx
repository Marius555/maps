import { Separator, Skeleton } from "@heroui/react";

/**
 * Shapes shared by the route-level `loading.tsx` files.
 *
 * v3's Skeleton is a standalone box, not a wrapper — there is no `isLoaded` and
 * you don't wrap real children in it. You render a tree that mirrors the real
 * one, which is why these live next to each other: if a skeleton stops matching
 * its page, the swap becomes a visible jump.
 *
 * "Mirrors" has to mean the whole box, not its outline. Each of these used to be
 * one flat rectangle roughly where the real thing goes, and the import step's was
 * a third of the height of the panel it stood in — so the swap dropped the page
 * 300px every time. A skeleton that is the wrong size is worse than none: it
 * promises a layout and then breaks the promise at the one moment nothing should
 * move.
 */

/** Mirrors the count-and-action row above the maps grid. */
export function ListActionsSkeleton() {
  return (
    <div className="flex items-center justify-between gap-4">
      <Skeleton className="h-4 w-24 rounded-lg" />
      <Skeleton className="h-9 w-28 rounded-3xl" />
    </div>
  );
}

/**
 * Mirrors SectionPanel: header block, rule, then the body.
 *
 * Down to the padding rhythm, because that is what decides the height. The real
 * panel is a `px-5 py-4 sm:px-6` header, a `Separator` hairline, and a
 * `space-y-4 px-5 py-5 sm:px-6` body — not one uniform `p-5` box, which is what
 * this drew before and why every panel skeleton sat short.
 *
 * `children` is the body when the caller knows what goes in it. `rows` is the
 * fallback for the panels that are simply a stack of fields.
 */
export function SectionPanelSkeleton({
  rows = 2,
  children,
}: {
  rows?: number;
  children?: React.ReactNode;
}) {
  return (
    <div className="rounded-xl border border-border bg-surface">
      <div className="space-y-2 px-5 py-4 sm:px-6">
        <Skeleton className="h-4 w-40 rounded-lg" />
        <Skeleton className="h-3 w-3/5 rounded-lg" />
      </div>

      <Separator />

      <div className="space-y-4 px-5 py-5 sm:px-6">
        {children ??
          Array.from({ length: rows }, (_, row) => (
            <Skeleton key={row} className="h-10 w-full rounded-xl" />
          ))}
      </div>
    </div>
  );
}

/** Mirrors PlaceListItem's 48px row — the stacked shape, below `lg`. */
export function PlaceRowsSkeleton({ rows = 6 }: { rows?: number }) {
  return (
    <div className="space-y-0.5">
      {Array.from({ length: rows }, (_, row) => (
        <div key={row} className="flex h-12 items-center gap-2 px-2">
          <Skeleton className="size-2.5 shrink-0 rounded-full" />
          <div className="min-w-0 flex-1 space-y-1.5">
            <Skeleton className="h-3.5 w-2/5 rounded-lg" />
            <Skeleton className="h-3 w-3/5 rounded-lg" />
          </div>
        </div>
      ))}
    </div>
  );
}

/**
 * Mirrors PlaceTable — the shape the Locations page actually has from `lg` up.
 *
 * The stacked rows above are the mobile list, and drawing them on a desktop was
 * promising a single 48px column where a seven-column table was about to land.
 * The two are rendered under the same `hidden lg:block` / `lg:hidden` pair the
 * page uses, so each breakpoint sees the shape it is going to get.
 *
 * The widths are the real columns' proportions: pin, name, address, tags,
 * status, missing, actions.
 */
const TABLE_COLUMNS = [
  { name: "name", width: "w-2/12" },
  { name: "address", width: "w-3/12" },
  { name: "tags", width: "w-2/12" },
  { name: "status", width: "w-2/12" },
  { name: "missing", width: "w-2/12" },
];

export function PlaceTableSkeleton({ rows = 8 }: { rows?: number }) {
  return (
    <div>
      {/* The heading strip: `text-xs` names on a `pb-2` baseline. */}
      <div className="flex items-center gap-3 pb-2 pl-2 pr-2">
        <Skeleton className="size-4 shrink-0 rounded-full" />
        {TABLE_COLUMNS.map((column) => (
          <Skeleton
            key={column.name}
            className={`h-3 rounded-lg ${column.width}`}
          />
        ))}
        <div className="w-10 shrink-0" />
      </div>

      {Array.from({ length: rows }, (_, row) => (
        <div
          key={row}
          className="flex items-center gap-3 border-t border-border py-2 pl-2 pr-2"
        >
          <Skeleton className="size-4 shrink-0 rounded-full" />
          {TABLE_COLUMNS.map((column) => (
            <Skeleton
              key={column.name}
              className={`h-4 rounded-lg ${column.width}`}
            />
          ))}
          <Skeleton className="size-8 shrink-0 rounded-lg" />
        </div>
      ))}
    </div>
  );
}
