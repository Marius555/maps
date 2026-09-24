import { Skeleton } from "@heroui/react";

/**
 * Stand-ins for the settings pages' data, sized to what replaces them.
 *
 * The `loading.tsx` files draw the real section headings and pass these as the
 * sections' bodies, so a swap changes what is drawn inside a section and never
 * where the next one starts. Heights here are measured against the real rows
 * (docs/notes/settings.md); change one and re-measure.
 */

/** A labelled field with its description line: `FormTextField` with `description`. */
export function FieldSkeleton() {
  // 80px, as measured: a 20px label, a 36px input, a 16px description, 4px gaps.
  return (
    <div className="space-y-1">
      <Skeleton className="h-5 w-28 rounded-lg" />
      <Skeleton className="h-9 w-full rounded-xl" />
      <Skeleton className="h-4 w-2/5 rounded-lg" />
    </div>
  );
}

/**
 * One `SettingsRow` with a one-line description: two 20px lines 2px apart
 * (42px, as measured), a small button on the right.
 */
export function RowSkeleton({ button = true }: { button?: boolean }) {
  return (
    <div className="flex flex-col gap-3 py-4 first:pt-0 last:pb-0 sm:flex-row sm:items-center sm:justify-between sm:gap-6">
      <div className="min-w-0 flex-1 space-y-0.5">
        <Skeleton className="h-5 w-48 max-w-full rounded-lg" />
        <Skeleton className="h-5 w-72 max-w-full rounded-lg" />
      </div>
      {button ? <Skeleton className="h-8 w-24 shrink-0 rounded-3xl" /> : null}
    </div>
  );
}

export function RowsSkeleton({ rows }: { rows: number }) {
  return (
    <div className="divide-y divide-separator">
      {Array.from({ length: rows }, (_, row) => (
        <RowSkeleton key={row} />
      ))}
    </div>
  );
}
