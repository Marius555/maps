"use client";

import { Button, Chip, Input, TextField } from "@heroui/react";
import { motion } from "motion/react";

import { formatCoords } from "@/lib/map/geo";
import type { DraftPlace } from "@/lib/csv/draft-places";

/**
 * One row in the review list.
 *
 * The name and address are editable here because the two things that stop a row
 * importing — a missing name, an address that found nothing — are both fixable in
 * place. Sending someone back to their spreadsheet to fix one typo would be the
 * worst part of the whole flow.
 */
export function ReviewRow({
  draft,
  isSelected,
  onSelect,
  onChange,
  onRemove,
}: {
  draft: DraftPlace;
  isSelected: boolean;
  onSelect: () => void;
  onChange: (patch: Partial<DraftPlace>) => void;
  onRemove: () => void;
}) {
  const isPlaced = draft.lat !== null && draft.lng !== null;

  return (
    <motion.li
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.15, ease: [0, 0, 0.2, 1] }}
      className={`space-y-2 rounded-xl border p-3 transition-colors ${
        isSelected ? "border-accent bg-surface-secondary" : "border-border"
      }`}
    >
      <div className="flex items-start justify-between gap-2">
        <span className="text-xs tabular-nums text-muted">
          Row {draft.rowNumber}
        </span>
        <StatusLabel draft={draft} />
      </div>

      <TextField
        fullWidth
        aria-label={`Name for row ${draft.rowNumber}`}
        value={draft.name}
        onChange={(name) => onChange({ name, problem: nextProblem(draft, name) })}
      >
        <Input placeholder="Location name" />
      </TextField>

      <p className="truncate text-xs text-muted" title={draft.address}>
        {draft.address || "No address in this row"}
      </p>

      {draft.matchedLabel && draft.matchedLabel !== draft.address ? (
        <p className="truncate text-xs text-muted" title={draft.matchedLabel}>
          Matched: {draft.matchedLabel}
        </p>
      ) : null}

      <div className="flex flex-wrap items-center justify-between gap-2">
        <span className="text-xs tabular-nums text-muted">
          {isPlaced
            ? formatCoords(draft.lat as number, draft.lng as number)
            : "Not placed"}
        </span>

        <div className="flex gap-2">
          {isPlaced ? (
            <Button size="sm" variant="tertiary" onPress={onSelect}>
              Show on map
            </Button>
          ) : null}
          <Button
            size="sm"
            variant="tertiary"
            aria-label={`Skip row ${draft.rowNumber}`}
            onPress={onRemove}
          >
            Skip
          </Button>
        </div>
      </div>

      {draft.problem ? (
        <p className="text-xs text-danger">{draft.problem}</p>
      ) : null}
    </motion.li>
  );
}

/** Recomputes the blocking problem after an inline edit. */
function nextProblem(draft: DraftPlace, name: string): string | null {
  if (!name.trim()) return "This row has no name. Add one, or skip the row.";

  if (!draft.address && draft.lat === null) {
    return "This row has no address and no coordinates, so it can't be placed.";
  }

  return null;
}

/**
 * Chips rather than coloured text. `--success` and `--warning` are fill tokens
 * with their own foreground partners; as text colours they land near 2:1 on the
 * page, and `--warning-foreground` is near-black so it disappears entirely in
 * dark mode. A soft Chip uses each pair the way it was designed.
 */
function StatusLabel({ draft }: { draft: DraftPlace }) {
  if (draft.status === "manual") {
    return <span className="text-xs text-muted">Placed by hand</span>;
  }

  if (draft.status === "ok") {
    return (
      <Chip size="sm" variant="soft" color="success">
        Good match
      </Chip>
    );
  }

  if (draft.status === "low") {
    return (
      <Chip size="sm" variant="soft" color="warning">
        Rough match — drag the pin
      </Chip>
    );
  }

  return (
    <Chip size="sm" variant="soft" color="danger">
      No match found
    </Chip>
  );
}
