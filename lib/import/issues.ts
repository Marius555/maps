/**
 * What is wrong with one row, field by field.
 *
 * The review step used to carry a single `problem: string | null` per draft, set
 * for exactly two conditions — no name, and no address and no coordinates. Every
 * other way a row can be wrong went unrecorded: a coordinate cell reading
 * "invalid_geo" was discarded and became indistinguishable from a row that never
 * had coordinates, and a website we couldn't repair was counted globally but
 * never attributed to the row that lost it. So the user was told "5 of 6 rows are
 * ready" with no way to find out which cell had been thrown away.
 *
 * One string also could not say *which field* to look at, which is what a fixable
 * error needs (CLAUDE.md §8: "state what happened and how to fix it"). A list of
 * field-scoped issues lets the row put the message beside the input that fixes it.
 *
 * Severity is about what it costs, not how it looks:
 *
 * - **error** — the row cannot be imported as it stands and only the user can
 *   change that. It blocks `importableDrafts`.
 * - **warning** — the row imports fine, but something was guessed, repaired or
 *   dropped along the way and saying so is the honest thing to do.
 */

export type IssueField = "name" | "address" | "coordinates" | "email" | "url";

export type IssueSeverity = "error" | "warning";

export type RowIssue = {
  field: IssueField;
  severity: IssueSeverity;
  message: string;
};

export function hasBlockingIssue(issues: RowIssue[]): boolean {
  return issues.some((issue) => issue.severity === "error");
}

/** Does this specific field block the row? Used to skip a geocode we'd waste. */
export function hasErrorOn(issues: RowIssue[], field: IssueField): boolean {
  return issues.some(
    (issue) => issue.field === field && issue.severity === "error",
  );
}

export function issuesFor(issues: RowIssue[], field: IssueField): RowIssue[] {
  return issues.filter((issue) => issue.field === field);
}

/**
 * A cell value, short enough to quote inside a sentence.
 *
 * Quoting the value is the whole point of these messages — "couldn't read the
 * coordinates" sends someone hunting through a spreadsheet, while "couldn't read
 * "invalid_geo"" tells them exactly which cell to open.
 */
export function quoteValue(raw: string, limit = 32): string {
  const value = raw.trim().replace(/\s+/g, " ");
  return value.length <= limit ? `"${value}"` : `"${value.slice(0, limit - 1)}…"`;
}
