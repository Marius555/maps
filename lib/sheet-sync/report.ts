import type { SheetLink, SheetSyncReport } from "./types";

/**
 * A sync runs in steps — Appwrite Sites answers no request past 30 seconds, and
 * a sheet with two hundred new addresses at a public geocoder's pace is minutes
 * of work. The owner sees one sync, so the steps' counts are added up.
 *
 * Skipped rows are *not* added up: every step re-reads the whole sheet and
 * reports every row it cannot use, including the addresses earlier steps failed
 * to place (they are remembered in `failedLookups`), so the latest step's list
 * is already the whole list.
 */
export function mergeStepReports(
  previous: SheetSyncReport,
  step: SheetSyncReport,
): SheetSyncReport {
  return {
    ...step,
    added: previous.added + step.added,
    updated: previous.updated + step.updated,
    removed: previous.removed + step.removed,
    republished: previous.republished || step.republished,
  };
}

/** Whether a report records anything a visitor of the live map would see. */
export function reportChangedMap(report: SheetSyncReport): boolean {
  return report.added + report.updated + report.removed > 0;
}

/** How long a failed lookup is trusted before the address is tried again. */
export const FAILED_LOOKUP_TTL_MS = 7 * 24 * 60 * 60 * 1000;

/**
 * The failed-lookup memory without its expired entries.
 *
 * Expired rather than kept forever because a geocoder's data improves — an
 * address on a new estate that nothing could find in spring may resolve by
 * summer — and a week of not asking is the saving that matters.
 */
export function freshFailedLookups(
  cache: SheetLink["failedLookups"],
  now: number,
): SheetLink["failedLookups"] {
  const fresh: SheetLink["failedLookups"] = {};

  for (const [key, entry] of Object.entries(cache)) {
    const at = Date.parse(entry?.at ?? "");
    if (Number.isFinite(at) && now - at < FAILED_LOOKUP_TTL_MS) fresh[key] = entry;
  }

  return fresh;
}
