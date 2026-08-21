/**
 * The column names.
 *
 * Named by what the user controls, per CLAUDE.md §8 — "Missing", not
 * "completeness"; "Status", not "geocodeStatus". The pin and the actions columns
 * have no heading anyone would read, so theirs is screen-reader only rather than
 * an empty cell that reads as a gap in the row.
 */
export function PlaceTableHead() {
  return (
    <thead>
      <tr className="text-left text-xs font-medium text-muted">
        <th scope="col" className="w-8 pb-2 pl-2 pr-1">
          <span className="sr-only">Pin</span>
        </th>
        <th scope="col" className="pb-2 pr-3">
          Name
        </th>
        <th scope="col" className="pb-2 pr-3">
          Address
        </th>
        <th scope="col" className="pb-2 pr-3">
          Category
        </th>
        <th scope="col" className="pb-2 pr-3">
          Status
        </th>
        <th scope="col" className="pb-2 pr-3">
          Missing
        </th>
        <th scope="col" className="w-10 pb-2 pr-2">
          <span className="sr-only">Actions</span>
        </th>
      </tr>
    </thead>
  );
}
