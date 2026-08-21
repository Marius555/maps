import { FIELD_LABELS, type ImportField } from "./fields";
import { createPlaceSchema, type CreatePlaceInput } from "@/lib/validation/place.schema";

/**
 * The last check before anything is sent.
 *
 * The bulk endpoint validates with the same schema, but it can only answer with
 * "Check the highlighted fields and try again." — a sentence written for a form,
 * where there are fields on screen to highlight. During an import there are
 * none: the user sees a review list of 200 rows and a message that names
 * neither the row nor the reason, which is exactly the error CLAUDE.md §8 says
 * we don't ship.
 *
 * Running the server's own schema here first costs nothing at runtime and turns
 * that into row numbers and a fixable instruction. It is not a replacement for
 * the server check — that one is the rule (§9) — it is the one that can still
 * see which row is which.
 */

/** How many rows we name before the sentence becomes a wall. */
const MAX_NAMED_ROWS = 3;

export function preflightProblem(
  inputs: { rowNumber: number; input: CreatePlaceInput }[],
): string | null {
  const failures: { rowNumber: number; label: string; message: string }[] = [];

  // Every row, not just the first. Stopping at one meant fixing a file with
  // three bad rows took three full import attempts to even discover.
  for (const { rowNumber, input } of inputs) {
    const result = createPlaceSchema.safeParse(input);
    if (result.success) continue;

    const issue = result.error.issues[0];
    const field = String(issue.path[0] ?? "");

    failures.push({
      rowNumber,
      label: FIELD_LABELS[field as ImportField] ?? field,
      message: issue.message,
    });
  }

  if (failures.length === 0) return null;

  const [first] = failures;

  // The fix is in the list on screen, not in the spreadsheet: name and address
  // are both editable there now, so sending someone back to their file and
  // through the whole wizard again would be advice that costs them ten minutes
  // for a typo.
  if (failures.length === 1) {
    return (
      `Row ${first.rowNumber} can't be saved — ${first.label}: ${first.message} ` +
      "Fix it in the list below, or skip the row."
    );
  }

  const named = failures.slice(0, MAX_NAMED_ROWS).map((failure) => failure.rowNumber);
  const rest = failures.length - named.length;
  const rows = named.join(", ") + (rest > 0 ? ` and ${rest} more` : "");

  return (
    `${failures.length} rows can't be saved — rows ${rows}. ` +
    `Row ${first.rowNumber} is ${first.label}: ${first.message} ` +
    "Fix them in the list below, or skip them."
  );
}
