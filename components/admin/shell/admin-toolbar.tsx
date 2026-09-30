import type { ReactNode } from "react";

import type { AdminRange } from "@/lib/validation/admin.schema";
import { AdminRangePicker } from "./admin-range-picker";

/**
 * The row above a page's figures: the period, and any fact about the install
 * that is not a figure (which upstream answers).
 *
 * **No title, no description.** The sidebar already says which page this is,
 * and a heading repeating it was the first thing on every page. The page's
 * `<title>` still names it for the tab and for a screen reader.
 */
export function AdminToolbar({ range, meta }: { range: AdminRange; meta?: ReactNode }) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-3">
      <div className="flex min-w-0 flex-wrap gap-2">{meta}</div>
      <AdminRangePicker range={range} />
    </div>
  );
}
