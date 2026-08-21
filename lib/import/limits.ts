/**
 * Ceilings shared by every import source.
 *
 * They live apart from any one parser because a Google Sheet, an XLSX and a CSV
 * all have to answer to the same numbers — a limit enforced in three places
 * drifts in three directions.
 */

/** Comfortably past a 3,000-row export; a bigger file is a different problem. */
export const MAX_SOURCE_BYTES = 5 * 1024 * 1024;

/**
 * The Pro plan's ceiling. Deliberately *not* the current user's plan limit:
 * truncating a free user's 400-row file to 10 rows at parse time would discard
 * their data silently. The plan check happens later, with the count visible.
 */
export const MAX_SOURCE_ROWS = 3000;

/** How many rows of the file the detector and the preview table look at. */
export const SAMPLE_ROWS = 50;

export function formatMb(bytes: number): string {
  return `${Math.round((bytes / (1024 * 1024)) * 10) / 10}MB`;
}
