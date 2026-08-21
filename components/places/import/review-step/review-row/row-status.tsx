import { Chip } from "@heroui/react";

import type { DraftPlace } from "@/lib/import/draft-places";

/**
 * How this row got where it is.
 *
 * Chips rather than coloured text. `--success` and `--warning` are fill tokens
 * with their own foreground partners; as text colours they land near 2:1 on the
 * page, and `--warning-foreground` is near-black so it disappears entirely in
 * dark mode. A soft Chip uses each pair the way it was designed.
 *
 * "Not looked up" is its own branch, and that is the fix for a real mislabel: the
 * old fallback covered `failed` *and* `pending`, so every row left over when the
 * address lookup was skipped or died mid-run was reported as "No match found".
 * Those rows were never searched for. Telling a customer we looked and found
 * nothing, when we never looked, sends them editing an address that was fine.
 */
export function RowStatus({ draft }: { draft: DraftPlace }) {
  if (draft.status === "manual") {
    return <span className="text-xs text-muted">Placed by hand</span>;
  }

  if (draft.status === "ok") {
    return (
      <Chip size="sm" variant="soft" color="success">
        Good match
      </Chip>
    );
  }

  if (draft.status === "low") {
    return (
      <Chip size="sm" variant="soft" color="warning">
        Rough match
      </Chip>
    );
  }

  if (draft.status === "pending") {
    return (
      <Chip size="sm" variant="soft">
        Not looked up
      </Chip>
    );
  }

  return (
    <Chip size="sm" variant="soft" color="danger">
      No match found
    </Chip>
  );
}
