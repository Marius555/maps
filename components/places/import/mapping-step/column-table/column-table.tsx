"use client";

import { Button } from "@heroui/react";
import { memo, useState } from "react";

import { formatCount } from "@/lib/format/number";
import type { HeaderSuggestion } from "@/lib/import/column-mapping";
import type { CsvRow } from "@/lib/import/draft-places";
import { SAMPLE_ROWS } from "@/lib/import/limits";
import { fieldOf, useImportStore } from "@/lib/stores/import-store";
import { CellInput } from "./cell-input";
import { ColumnHeader } from "./column-header";

/**
 * The file, with our reading of it written across the top.
 *
 * This replaces fourteen dropdowns and a read-only preview of their result. Both
 * were answering the same question — did we read your file correctly? — and only
 * the preview was answering it in the user's own terms. Putting the picker into
 * the preview's header leaves one thing on screen instead of two, and the answer
 * is now in the same place as the question.
 *
 * A column with no field heads itself with an em dash and a chevron, which is
 * what asks for the assignment. That is deliberately the *only* way this step
 * asks: the modal that used to open over the top could only ask about the fields
 * we knew we needed, and it asked them against column names that were already
 * established as useless. A dash over three rows of real values is a better
 * question than any sentence about it.
 */
/**
 * One frozen empty array, so a column with no suggestions hands `ColumnHeader`
 * the same reference on every render rather than a fresh `[]`.
 */
const EMPTY_SUGGESTIONS: HeaderSuggestion[] = [];

export function ColumnTable() {
  const headers = useImportStore((state) => state.headers);
  const rows = useImportStore((state) => state.rows);
  const mapping = useImportStore((state) => state.mapping);
  const detection = useImportStore((state) => state.detection);
  const suggestions = useImportStore((state) => state.suggestions);
  const setColumnField = useImportStore((state) => state.setColumnField);
  const setCell = useImportStore((state) => state.setCell);

  /*
   * Fifty rows is the detector's own sample (`lib/import/limits.ts`) and about
   * 750 live inputs at fifteen columns. The cap is a rendering budget, not a
   * limit on the import — a 3,000-row file would be 45,000 of them — so the note
   * under the table says so, and anyone who needs row 300 can lift it.
   */
  const [showAll, setShowAll] = useState(false);
  const visible = showAll ? rows : rows.slice(0, SAMPLE_ROWS);

  return (
    <div className="space-y-2">
      {/* The grid is wider than any phone and often wider than a laptop, so it
          scrolls inside its own frame rather than the page scrolling sideways.
          `border-separate` is what keeps the sticky header's own border painted
          — a collapsed border belongs to the table, and scrolls away with it. */}
      <div className="max-h-[34rem] overflow-auto rounded-xl border border-border">
        <table className="w-full min-w-max border-separate border-spacing-0 text-left text-xs">
          <thead className="sticky top-0 z-20">
            <tr>
              <th
                scope="col"
                className="sticky left-0 z-10 border-b border-r border-border bg-surface-secondary px-2 py-2"
              >
                <span className="sr-only">Row</span>
              </th>

              {headers.map((header) => {
                const field = fieldOf(mapping, header);

                return (
                  <ColumnHeader
                    key={header}
                    header={header}
                    field={field}
                    mapping={mapping}
                    detection={field ? detection[field] : undefined}
                    suggestions={suggestions[header] ?? EMPTY_SUGGESTIONS}
                    onChange={(next) => setColumnField(header, next)}
                  />
                );
              })}
            </tr>
          </thead>

          <tbody>
            {visible.map((row, index) => (
              // Position is the identity here: rows are edited in place and this
              // list is never sorted, filtered or reordered.
              <TableRow
                key={index}
                row={row}
                rowIndex={index}
                headers={headers}
                onCellChange={setCell}
              />
            ))}
          </tbody>
        </table>
      </div>

      {rows.length > visible.length ? (
        <p className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-muted">
          Showing the first {formatCount(visible.length)} of{" "}
          {formatCount(rows.length)} rows. All of them will be imported.
          <Button size="sm" variant="ghost" onPress={() => setShowAll(true)}>
            Show every row
          </Button>
        </p>
      ) : null}
    </div>
  );
}

/**
 * Memoised, and that is what makes typing feel like typing.
 *
 * `setCell` replaces one row and keeps the identity of the others, so a keystroke
 * re-renders fifteen inputs rather than seven hundred and fifty. It relies on
 * `setCell` being a stable reference, which a Zustand action is.
 */
const TableRow = memo(function TableRow({
  row,
  rowIndex,
  headers,
  onCellChange,
}: {
  row: CsvRow;
  rowIndex: number;
  headers: string[];
  onCellChange: (rowIndex: number, header: string, value: string) => void;
}) {
  return (
    <tr>
      <th
        scope="row"
        className="sticky left-0 z-10 border-b border-r border-border bg-surface px-2 py-1.5 text-right align-middle text-xs font-normal tabular-nums text-muted"
      >
        {rowIndex + 1}
      </th>

      {headers.map((header) => (
        <td key={header} className="border-b border-border p-0 align-middle">
          <CellInput
            value={row[header] ?? ""}
            label={`${header}, row ${rowIndex + 1}`}
            onChange={(value) => onCellChange(rowIndex, header, value)}
          />
        </td>
      ))}
    </tr>
  );
});
