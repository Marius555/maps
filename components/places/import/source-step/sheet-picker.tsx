"use client";

import { SelectControl } from "@/components/ui/select-control";

/**
 * Which sheet of the workbook.
 *
 * Only shown when there is more than one, because most workbooks have a data
 * sheet and a "Notes" sheet and picking the wrong one wastes the whole import.
 * The first sheet is loaded straight away — this changes it rather than gating on
 * it, so the common case stays one click.
 */
export function SheetPicker({
  sheetNames,
  current,
  isBusy,
  onChange,
}: {
  sheetNames: string[];
  current: string | null;
  isBusy: boolean;
  onChange: (sheetName: string) => void;
}) {
  if (sheetNames.length < 2) return null;

  return (
    <div className="flex flex-wrap items-end gap-3 rounded-lg bg-surface-secondary px-4 py-3">
      <div className="min-w-48 flex-1">
        <SelectControl
          label="Sheet"
          isDisabled={isBusy}
          options={sheetNames.map((name) => ({ id: name, label: name }))}
          value={current ?? sheetNames[0]}
          onChange={onChange}
        />
      </div>

      <p className="pb-2 text-xs text-muted">
        This workbook has {sheetNames.length} sheets.
      </p>
    </div>
  );
}
