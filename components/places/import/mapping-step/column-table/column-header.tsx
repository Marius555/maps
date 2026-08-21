"use client";

import { InlineSelect } from "@/components/ui/inline-select";
import type {
  ColumnMapping,
  FieldDetection,
  HeaderSuggestion,
} from "@/lib/import/column-mapping";
import { FIELD_LABELS, type ImportField } from "@/lib/import/fields";
import { ConfidenceMark } from "../confidence-mark";
import { UNASSIGNED, fieldOptions, toField } from "./field-options";

/**
 * What we think one column of the file is, and the control that changes it.
 *
 * The field name is the heading and the column's own name is the subtitle,
 * because by this point the user has already decided our reading matters more
 * than theirs — they are here to check it. An unassigned column heads itself
 * with an em dash: a blank would read as a rendering fault, and "Don't import"
 * as a decision nobody made.
 *
 * The confidence mark sits *inside* the trigger, on the heading's own line and
 * at its own size. It used to be a chip on the line below, next to the column
 * name, which put the qualifier further from the thing it qualified than from
 * the thing it did not — and made the header two lines of two type sizes for
 * what is really one statement: "this column is the Name, and we are fairly
 * sure". Being inside the trigger also means it is inside the hover and press
 * target, so the mark is part of the control rather than debris beside it.
 *
 * Nothing here carries an action, either. The one a column can have — splitting a
 * combined coordinate column in two — sits above the table instead: a `<th>` is
 * as tall as the tallest one in the row, so a button on one column padded every
 * other header with the same dead band, and on a phone it hid inside the
 * horizontal scroll where nobody would find it.
 *
 * Nothing here reports a validation problem, and that is not an omission. Every
 * field-scoped problem `validateColumnMapping` can raise names a field that no
 * column currently holds — a missing name, half a coordinate pair — because the
 * picker enforces the one-to-one itself and detection already did. There is by
 * definition no column to put the message on, which is what the banner under the
 * table is for.
 */
export function ColumnHeader({
  header,
  field,
  mapping,
  detection,
  suggestions,
  onChange,
}: {
  header: string;
  field: ImportField | undefined;
  mapping: ColumnMapping;
  detection: FieldDetection | undefined;
  /** What this column could be, best first. Ranks the picker — may be empty. */
  suggestions: HeaderSuggestion[];
  onChange: (field: ImportField | undefined) => void;
}) {
  return (
    <th
      scope="col"
      className="min-w-44 border-b border-border bg-surface-secondary px-1 py-2 text-left align-top font-normal"
    >
      <div className="space-y-1">
        <InlineSelect
          label={`Column “${header}”, currently ${
            field ? FIELD_LABELS[field] : "not assigned"
          }`}
          options={fieldOptions(mapping, header, suggestions)}
          value={field ?? UNASSIGNED}
          className={
            field
              ? "text-sm font-medium text-foreground"
              : "text-sm font-medium text-muted"
          }
          onChange={(value) => onChange(toField(value))}
        > 
          <ConfidenceMark
            confidence={detection?.confidence}
            isAssigned={Boolean(field)}
            reason={detection?.reason ?? null}
          />
          {field ? FIELD_LABELS[field] : "—"}
        </InlineSelect>

        <p className="truncate px-1.5 text-xs text-muted" title={header}>
          {header}
        </p>
      </div>
    </th>
  );
}
