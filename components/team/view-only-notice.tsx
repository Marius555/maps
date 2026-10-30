"use client";

import { Eye } from "lucide-react";

import { useCan } from "./role-context";

/**
 * One line saying why nothing on this page changes anything — for a team's
 * viewer, and nobody else. Drawn by the pages whose controls are hidden or
 * refused for a viewer, so the missing buttons have a reason beside them.
 */
export function ViewOnlyNotice({ what = "this map" }: { what?: string }) {
  const canEdit = useCan("edit");

  if (canEdit) return null;

  return (
    <p
      role="note"
      className="flex items-center gap-2 rounded-lg bg-surface-secondary px-3 py-2 text-sm text-muted"
    >
      <Eye aria-hidden="true" className="size-4 shrink-0" />
      <span>
        View only — you can see {what} but not change it. Ask an admin for editor access.
      </span>
    </p>
  );
}
