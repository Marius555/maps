"use client";

import { Table } from "@heroui/react";
import { useMemo, useState, type ReactNode } from "react";

/**
 * The table every section of the Analytics page is drawn with.
 *
 * **A real HeroUI `Table`**, which is React Aria underneath — so the header is a
 * `columnheader` a screen reader can sort from, arrow keys move between cells,
 * and the sort state is announced rather than only drawn. The rest of this app
 * hand-writes `<table>` because those tables have no state to own; these have
 * five columns of counts and the first question anybody asks is "sort by that
 * one", which is exactly the affordance the component exists for.
 *
 * One generic table rather than five hand-written ones, because the alternative
 * is the same sort state written out five times — and four of them eventually
 * disagreeing about whether a tie breaks by name.
 *
 * Sorting is client-side over the whole set. The rows are already here: the page
 * is a server component that folded them out of a rollup, so there is nothing to
 * fetch and a sort is a re-render, not a request.
 */

export type DataColumn<T> = {
  id: string;
  label: string;
  /** The identifying column. Exactly one per table, and it is not sortable. */
  isRowHeader?: boolean;
  /** Numbers go right, so their digits line up down the column. */
  numeric?: boolean;
  sortable?: boolean;
  /** What to sort on. Not what to draw — a share bar has no order of its own. */
  sortValue?: (row: T) => string | number;
  render: (row: T) => ReactNode;
  /** Hidden below `sm`, for a column that is detail rather than the point. */
  secondary?: boolean;
};

export type DataTableProps<T> = {
  /** The accessible name. Required by React Aria, and it is not the heading. */
  label: string;
  columns: DataColumn<T>[];
  rows: T[];
  rowKey: (row: T) => string;
  /** Column id to sort by on first render. Descending, because these are counts. */
  initialSort?: string;
  /**
   * How many rows to draw.
   *
   * A cap rather than pagination: these tables answer "which are the busiest",
   * and the tail of a three-hundred-row list is not a page anybody turns to. The
   * footer says how many were left out rather than hiding the fact.
   */
  limit?: number;
};

export function DataTable<T>({
  label,
  columns,
  rows,
  rowKey,
  initialSort,
  limit = 20,
}: DataTableProps<T>) {
  const [sort, setSort] = useState<{ column: string; direction: "ascending" | "descending" }>(
    { column: initialSort ?? columns[0].id, direction: "descending" },
  );

  const sorted = useMemo(() => {
    const column = columns.find((entry) => entry.id === sort.column);
    if (!column?.sortValue) return rows;

    const read = column.sortValue;
    const ordered = [...rows].sort((a, b) => {
      const left = read(a);
      const right = read(b);

      if (typeof left === "number" && typeof right === "number") {
        return left - right;
      }

      return String(left).localeCompare(String(right));
    });

    return sort.direction === "descending" ? ordered.reverse() : ordered;
  }, [rows, columns, sort]);

  const shown = sorted.slice(0, limit);
  const hidden = sorted.length - shown.length;

  return (
    <Table>
      {/* Its own scroller, so a long location name can never push the page
          sideways — the same rule place-table.tsx follows. */}
      <Table.ScrollContainer>
        <Table.Content
          aria-label={label}
          sortDescriptor={sort}
          onSortChange={(descriptor) => {
            const column = String(descriptor.column);

            setSort({
              column,
              /*
               * A count column opens on its biggest value.
               *
               * React Aria starts every newly-sorted column ascending, which is
               * right for names and wrong for numbers: pressing "Directions" on
               * a table of busiest locations should not answer with the five
               * nobody asked directions to. Once the column is already the
               * sorted one, the press is a flip and is left alone.
               */
              direction:
                column === sort.column
                  ? descriptor.direction
                  : isNumeric(columns, column)
                    ? "descending"
                    : "ascending",
            });
          }}
        >
          <Table.Header>
            {columns.map((column) => (
              <Table.Column
                key={column.id}
                id={column.id}
                isRowHeader={column.isRowHeader}
                allowsSorting={column.sortable !== false && !!column.sortValue}
                className={cellClass(column, true)}
              >
                {({ sortDirection }) => (
                  <Table.SortableColumnHeader sortDirection={sortDirection}>
                    {column.label}
                  </Table.SortableColumnHeader>
                )}
              </Table.Column>
            ))}
          </Table.Header>

          <Table.Body items={shown.map((row) => ({ ...row, id: rowKey(row) }))}>
            {(item) => (
              <Table.Row id={item.id}>
                {columns.map((column) => (
                  <Table.Cell key={column.id} className={cellClass(column, false)}>
                    {column.render(item as T)}
                  </Table.Cell>
                ))}
              </Table.Row>
            )}
          </Table.Body>
        </Table.Content>
      </Table.ScrollContainer>

      {hidden > 0 ? (
        /*
          "Showing 25 of 100" rather than "the busiest 25", because the sort is
          the reader's to change: this same footer sits under the ranked tables
          and under Recent visitors, which is ordered by time and has no busiest.
          A count is true whichever column the table is sorted by.
        */
        <p className="px-1 pt-2 text-xs text-muted">
          Showing {shown.length} of {sorted.length}.
        </p>
      ) : null}
    </Table>
  );
}

function isNumeric<T>(columns: DataColumn<T>[], id: string): boolean {
  return columns.find((column) => column.id === id)?.numeric ?? false;
}

function cellClass<T>(column: DataColumn<T>, isHeader: boolean): string {
  return [
    column.numeric ? "text-right tabular-nums whitespace-nowrap" : "",
    column.secondary ? "hidden sm:table-cell" : "",
    isHeader ? "text-xs font-medium" : "",
  ]
    .filter(Boolean)
    .join(" ");
}
