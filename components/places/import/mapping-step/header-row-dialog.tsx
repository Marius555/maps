"use client";

import { Button, Modal } from "@heroui/react";
import { useState } from "react";

import { SelectControl, type SelectOption } from "@/components/ui/select-control";
import type { HeaderRowChoice } from "@/lib/import/table";

/** How many rows are worth offering — past this we're guessing about a guess. */
const OFFERED_ROWS = 10;

/** Enough of a row to recognise it, without wrapping the option into a table. */
const PREVIEW_CELLS = 6;

/** The "no header row at all" option, kept out of the numeric key space. */
const NO_HEADER = "none";

/**
 * Choose which row holds the column names.
 *
 * The detector reads the row that best explains the data under it, which is
 * right far more often than "row 0" was — but it is still a heuristic, and
 * before this a user had no way to overrule it. A file whose header it got wrong
 * was simply unimportable, and nothing on screen said why.
 *
 * Each option shows the row's own cells, not just "Row 2": "row 2" is meaningless
 * next to a spreadsheet open in another window, and the entire question being
 * asked is *which of these is the names*.
 */
export function HeaderRowDialog({
  cells,
  current,
  isOpen,
  onOpenChange,
  onChoose,
}: {
  cells: string[][];
  /** The row in use, or null when we named the columns ourselves. */
  current: number | null;
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  onChoose: (choice: HeaderRowChoice) => void;
}) {
  const [selected, setSelected] = useState(keyOf(current));

  const options: SelectOption[] = [
    ...cells.slice(0, OFFERED_ROWS).map((row, index) => ({
      id: String(index),
      label: `Row ${index + 1}`,
      description: summarise(row),
    })),
    {
      id: NO_HEADER,
      label: "This file has no header row",
      description: "We'll name the columns and match them on their contents",
    },
  ];

  const apply = () => {
    onChoose(selected === NO_HEADER ? NO_HEADER : Number(selected));
    onOpenChange(false);
  };

  return (
    <Modal.Backdrop
      isOpen={isOpen}
      onOpenChange={(open) => {
        // Reopening shows what's actually in use, not the last thing that was
        // browsed to and abandoned.
        if (open) setSelected(keyOf(current));
        onOpenChange(open);
      }}
    >
      <Modal.Container>
        <Modal.Dialog>
          <Modal.CloseTrigger />
          <Modal.Header>
            <Modal.Heading>Which row has your column names?</Modal.Heading>
          </Modal.Header>

          <Modal.Body className="space-y-4">
            <p className="text-xs text-muted">
              We picked the row that best explains the data under it. Anything
              above the row you choose is ignored.
            </p>

            <SelectControl
              label="Column names are in"
              options={options}
              value={selected}
              onChange={setSelected}
            />
          </Modal.Body>

          <Modal.Footer>
            <Button slot="close" variant="secondary">
              Cancel
            </Button>
            <Button onPress={apply}>Use this row</Button>
          </Modal.Footer>
        </Modal.Dialog>
      </Modal.Container>
    </Modal.Backdrop>
  );
}

function keyOf(current: number | null): string {
  return current === null ? NO_HEADER : String(current);
}

/** A row as one readable line. Empty cells are dropped, not rendered blank. */
function summarise(row: string[]): string {
  const filled = row.map((cell) => cell.trim()).filter(Boolean);

  if (filled.length === 0) return "(empty row)";

  const shown = filled.slice(0, PREVIEW_CELLS).join(" · ");

  return filled.length > PREVIEW_CELLS ? `${shown} · …` : shown;
}
