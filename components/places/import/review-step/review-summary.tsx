"use client";

import { ErrorMessage } from "@/components/ui/error-message";
import { formatCount } from "@/lib/format/number";
import type { DraftPlace } from "@/lib/import/draft-places";

/**
 * What this import currently amounts to, in numbers.
 *
 * The panel's own description says it in a sentence; this says it in counts,
 * because a sentence is what you read once and a count is what you watch change
 * as you fix rows. "12 need attention" ticking down to zero is the feedback that
 * says the work is finished, and it is the thing that was missing when the only
 * signal was rows quietly leaving a filtered list.
 *
 * `geocodeError` is repeated here deliberately. It is set on the address-lookup
 * step and was only ever shown there, so the moment the user moved on they lost
 * the one explanation for why half their rows have no pin — and the rows
 * themselves can only say "not looked up", not why.
 */
export function ReviewSummary({
  drafts,
  importable,
  needsReview,
  unplaced,
  skippedBlankRows,
  droppedContacts,
  geocodeError,
}: {
  drafts: DraftPlace[];
  importable: number;
  needsReview: number;
  unplaced: number;
  skippedBlankRows: number;
  droppedContacts: number;
  geocodeError: string | null;
}) {
  const notes: string[] = [];

  if (skippedBlankRows > 0) {
    notes.push(
      `${formatCount(skippedBlankRows)} blank ${
        skippedBlankRows === 1 ? "row was" : "rows were"
      } skipped.`,
    );
  }

  if (droppedContacts > 0) {
    notes.push(
      `${formatCount(droppedContacts)} website or email ${
        droppedContacts === 1 ? "value" : "values"
      } couldn't be read — the rows that lost one say so.`,
    );
  }

  return (
    <div className="space-y-2">
      <dl className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs">
        <Tally label="ready to import" value={importable} total={drafts.length} />
        <Tally label="need attention" value={needsReview} isAlert={needsReview > 0} />
        {unplaced > 0 ? <Tally label="not placed" value={unplaced} isAlert /> : null}
      </dl>

      {notes.length > 0 ? (
        <p className="text-xs text-muted">{notes.join(" ")}</p>
      ) : null}

      {geocodeError ? <ErrorMessage error={geocodeError} /> : null}
    </div>
  );
}

function Tally({
  label,
  value,
  total,
  isAlert,
}: {
  label: string;
  value: number;
  total?: number;
  isAlert?: boolean;
}) {
  return (
    <div className="flex items-baseline gap-1.5">
      <dt className="sr-only">{label}</dt>
      <dd
        className={`text-sm font-semibold tabular-nums ${
          isAlert ? "text-danger" : "text-foreground"
        }`}
      >
        {formatCount(value)}
        {total === undefined ? null : (
          <span className="font-normal text-muted"> of {formatCount(total)}</span>
        )}
      </dd>
      <span aria-hidden className="text-muted">
        {label}
      </span>
    </div>
  );
}
