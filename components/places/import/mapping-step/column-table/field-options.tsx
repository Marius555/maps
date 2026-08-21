import type { SelectOption } from "@/components/ui/select-control";
import type { ColumnMapping, HeaderSuggestion } from "@/lib/import/column-mapping";
import {
  FIELD_HINTS,
  FIELD_LABELS,
  IMPORT_FIELDS,
  type ImportField,
} from "@/lib/import/fields";
import { ConfidenceMark } from "../confidence-mark";

/** Not an `ImportField`, so it can never be mistaken for one. */
export const UNASSIGNED = "__unassigned";

const LIKELY_SECTION = "Likely for this column";
const REST_SECTION = "All fields";

/**
 * What one column of the file can be, best guesses first.
 *
 * The old picker listed the file's columns under a fixed field name; this lists
 * the field names under a fixed column, which is the same one-to-one read from
 * the side the user is actually looking at.
 *
 * **The ranking is the point.** Fourteen fields in canonical order are fourteen
 * rows that look exactly alike, and the one moment this menu matters is when we
 * guessed wrong and someone has to find the right answer in it. The detector
 * already scored every field against every column on its way to picking a
 * winner; `byHeader` is that working shown, so the two or three fields whose
 * values actually look like this column's values come first, each with its own
 * mark and the reason it is there.
 *
 * A field already taken by another column says so rather than being hidden or
 * disabled. Hiding it would make "where did Name go?" unanswerable on a file
 * where we guessed Name onto the wrong column — which is the exact case this
 * step exists to fix — and picking it simply moves it.
 */
export function fieldOptions(
  mapping: ColumnMapping,
  header: string,
  suggestions: HeaderSuggestion[],
): SelectOption[] {
  const likely = suggestions.map((suggestion) => ({
    id: suggestion.field,
    label: FIELD_LABELS[suggestion.field],
    // Assigned, because in this menu the mark is rating the *option*, not
    // reporting the column's current state — every row here is something the
    // column could be, so none of them is a no-match.
    icon: (
      <ConfidenceMark
        confidence={suggestion.confidence}
        isAssigned
        reason={null}
      />
    ),
    description:
      conflict(mapping, suggestion.field, header) ?? suggestion.reason,
    section: LIKELY_SECTION,
  }));

  const ranked = new Set(suggestions.map((suggestion) => suggestion.field));

  const rest = IMPORT_FIELDS.filter((field) => !ranked.has(field)).map(
    (field) => ({
      id: field,
      label: FIELD_LABELS[field],
      description: conflict(mapping, field, header) ?? FIELD_HINTS[field],
      section: REST_SECTION,
    }),
  );

  /*
   * "Don't import" stays pinned at the top rather than being demoted below the
   * ranked fields, even though it is never the likely answer. It is the current
   * value of every column we could not place, and React Aria scrolls an open
   * menu to its selected item — so from the one column that most needs the
   * ranking, putting it anywhere else would open the menu *past* the ranking.
   */
  return [{ id: UNASSIGNED, label: "Don't import" }, ...likely, ...rest];
}

/** The picked id back to a field. `undefined` for "Don't import". */
export function toField(value: string): ImportField | undefined {
  return IMPORT_FIELDS.find((field) => field === value);
}

/**
 * Where this field currently lives, when that isn't here.
 *
 * Takes precedence over the hint and over the detector's reason: that picking
 * this moves the field off another column is the more urgent thing to know, and
 * it is the only one of the three the user can be surprised by.
 */
function conflict(
  mapping: ColumnMapping,
  field: ImportField,
  header: string,
): string | undefined {
  const claimed = mapping[field];

  return claimed && claimed !== header ? `Now on “${claimed}”` : undefined;
}
