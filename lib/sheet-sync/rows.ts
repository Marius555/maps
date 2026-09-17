import type { DraftPlace } from "@/lib/import/draft-places";
import type { SheetRow } from "./diff";
import { sourceKeysFor } from "./row-key";
import type { SheetSyncSkip } from "./types";

/**
 * The sheet's rows, split into the ones a sync can use and the ones it has to
 * report.
 *
 * A row needs a name, and either coordinates or an address to look up — the
 * same two things the import's review step refuses to go without. Blank rows
 * never get here (`buildDraftPlaces` drops them) and are not worth reporting.
 *
 * Keys are assigned over the usable rows only, so a half-typed row further up
 * the sheet cannot renumber the duplicates below it.
 */
export function usableSheetRows(drafts: readonly DraftPlace[]): {
  rows: SheetRow[];
  skipped: SheetSyncSkip[];
} {
  const usable: DraftPlace[] = [];
  const skipped: SheetSyncSkip[] = [];

  for (const draft of drafts) {
    if (!draft.name.trim()) {
      skipped.push({ row: draft.rowNumber, name: "", reason: "This row has no name." });
      continue;
    }

    if ((draft.lat === null || draft.lng === null) && !draft.address.trim()) {
      skipped.push({
        row: draft.rowNumber,
        name: draft.name,
        reason: "This row has no address and no coordinates.",
      });
      continue;
    }

    usable.push(draft);
  }

  const keys = sourceKeysFor(usable);

  return {
    rows: usable.map((draft, index) => ({ key: keys[index], draft })),
    skipped,
  };
}

/**
 * Whether a sync may go ahead and remove what it found missing.
 *
 * A sheet that comes back empty, or missing most of its rows, is far more often
 * an accident — a cleared tab, a filter view, the wrong tab after a rename — than
 * an owner closing two thirds of their stores overnight. The daily sync must not
 * act on that alone, because by the time anyone looks the locations and every
 * photo on them are gone. So it stops and asks.
 *
 * Small removals go through: deleting a row or two is exactly what editing a
 * sheet is for, and asking about it every time would teach people to click
 * through the question.
 */
export function removalsNeedConfirmation({
  removals,
  linkedCount,
  incomingCount,
}: {
  removals: number;
  linkedCount: number;
  incomingCount: number;
}): boolean {
  if (removals === 0) return false;
  if (incomingCount === 0) return true;

  return removals >= 3 && removals * 2 > linkedCount;
}
