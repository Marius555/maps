import { Skeleton } from "@heroui/react";

/**
 * Shown while a console page loads — right after signing in, and between
 * sections.
 *
 * It is what makes the login honest: the layout above it is a cookie check and
 * nothing more, so this streams almost at once and the metrics (seconds of
 * reads across every account) arrive inside the console rather than behind a
 * login form that looked frozen. Changing the period never reaches it — that is
 * a transition, which keeps the old figures on screen.
 *
 * It mirrors the shape every page now shares: the period on the right (no
 * page title — the sidebar names the page), the strip of figures, the tabbed
 * chart, then a table. It renders inside the layout's
 * `max-w-7xl` column, so nothing moves when the page replaces it.
 */
export default function AdminLoading() {
  return (
    <div aria-busy="true" aria-label="Loading" className="space-y-6">
      <div className="flex justify-end">
        <Skeleton className="h-9 w-40 rounded-xl" />
      </div>

      <Skeleton className="h-28 w-full rounded-3xl" />
      <Skeleton className="h-[25rem] w-full rounded-3xl" />
      <Skeleton className="h-72 w-full rounded-3xl" />
    </div>
  );
}
