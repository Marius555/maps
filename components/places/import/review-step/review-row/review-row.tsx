"use client";

import { Button, Input, Label, TextField } from "@heroui/react";
import { Crosshair, X } from "lucide-react";
import { motion } from "motion/react";

import { CoordinateFields } from "@/components/places/coordinate-fields";
import { AddressSearchField } from "@/components/places/place-form/address-search-field";
import { IconButton } from "@/components/ui/icon-button";
import type { DraftPlace } from "@/lib/import/draft-places";
import { issuesFor } from "@/lib/import/issues";
import { formatCoords, roundCoord } from "@/lib/map/geo";
import { RowAlternatives } from "./row-alternatives";
import { RowIssues } from "./row-issues";
import { RowStatus } from "./row-status";

/**
 * One row in the review list.
 *
 * Closed, it is a single line: which row this is, what it is called, where it
 * landed, and how much to trust that. It used to be five stacked blocks and
 * three wrapped text buttons, which made a list of thirty rows a page of cards
 * to scroll rather than a list to scan — and scanning is the whole job here.
 *
 * Open, every one of those becomes editable: the name and the address side by
 * side, the geocoder's other matches, and the coordinates themselves with
 * "Place on map" on the same line.
 *
 * Rows that cannot be imported as they stand start open, and stay where the user
 * puts them after that. Opening every row would be the wall of fields this step
 * is meant to avoid; opening none would hide the fix behind a click on exactly
 * the rows that need it.
 *
 * Whether it is open is the list's state, not this component's, because it
 * decides more than a chevron: an open row stays listed even after its last
 * problem clears. Held locally, typing the first letter of a missing name would
 * fix the row, drop it out of "only rows that need attention", and delete the
 * field from under the cursor.
 */
export function ReviewRow({
  draft,
  mapId,
  isSelected,
  isPlacing,
  isOpen,
  onSelect,
  onChange,
  onRemove,
  onTogglePlacing,
  onToggleOpen,
}: {
  draft: DraftPlace;
  mapId: string;
  isSelected: boolean;
  /** True while this row is the one a map click will place. */
  isPlacing: boolean;
  /** True while the editing controls are showing. Owned by the list. */
  isOpen: boolean;
  onSelect: () => void;
  onChange: (patch: Partial<DraftPlace>) => void;
  onRemove: () => void;
  onTogglePlacing: () => void;
  onToggleOpen: () => void;
}) {
  const isPlaced = draft.lat !== null && draft.lng !== null;

  const placementIssues = [
    ...issuesFor(draft.issues, "address"),
    ...issuesFor(draft.issues, "coordinates"),
  ];
  const contactIssues = [
    ...issuesFor(draft.issues, "email"),
    ...issuesFor(draft.issues, "url"),
  ];

  const where = [
    draft.address || "No address in this row",
    isPlaced ? formatCoords(draft.lat as number, draft.lng as number) : "Not placed",
    draft.matchedLabel && draft.matchedLabel !== draft.address
      ? `Matched: ${draft.matchedLabel}`
      : null,
  ]
    .filter(Boolean)
    .join(" · ");

  return (
    <motion.li
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.15, ease: [0, 0, 0.2, 1] }}
      className={`rounded-xl border px-2 py-1.5 transition-colors ${
        isSelected ? "border-accent bg-surface-secondary" : "border-border"
      }`}
    >
      {/*
       * One line where it fits and two where it doesn't, with no breakpoint:
       * the text block asks for 10rem, so the status and the actions wrap under
       * it on a phone and sit beside it everywhere else.
       */}
      <div className="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1">
        <span
          className="w-6 shrink-0 text-right text-xs tabular-nums text-muted"
          title={`Row ${draft.rowNumber}`}
        >
          {draft.rowNumber}
        </span>

        <div className="min-w-0 flex-1 basis-40">
          <p className="truncate text-sm font-medium text-foreground">
            {draft.name || `Row ${draft.rowNumber}`}
          </p>
          <p className="truncate text-xs text-muted" title={where}>
            {where}
          </p>
        </div>

        <RowStatus draft={draft} />

        <div className="ml-auto flex shrink-0 items-center gap-0.5">
          <Button size="sm" variant="tertiary" onPress={onToggleOpen}>
            {isOpen ? "Done" : "Fix"}
          </Button>

          {isPlaced ? (
            <IconButton
              label="Show on map"
              icon={Crosshair}
              iconClassName="size-3.5"
              onPress={onSelect}
            />
          ) : null}

          <IconButton
            label={`Skip row ${draft.rowNumber}`}
            icon={X}
            iconClassName="size-3.5"
            onPress={onRemove}
          />
        </div>
      </div>

      {isOpen ? (
        <div className="space-y-3 px-1 pb-1 pt-3">
          <div className="grid gap-3 sm:grid-cols-2">
            <TextField
              fullWidth
              value={draft.name}
              onChange={(name) => onChange({ name })}
            >
              <Label>Name</Label>
              <Input />
            </TextField>

            <AddressSearchField
              mapId={mapId}
              value={draft.address}
              label="Address"
              hint={null}
              onChange={(address) => onChange({ address })}
              onPick={(candidate) => {
                // Chosen deliberately, so it stops being a geocoder guess and
                // stops being flagged — the same rule the editor's form applies.
                onChange({
                  address: candidate.label || draft.address,
                  lat: roundCoord(candidate.lat),
                  lng: roundCoord(candidate.lng),
                  matchedLabel: candidate.label,
                  confidence: candidate.confidence,
                  status: "manual",
                });
              }}
            />
          </div>

          <RowIssues issues={[...issuesFor(draft.issues, "name"), ...placementIssues]} />

          <RowAlternatives
            candidates={draft.alternatives}
            onPick={(candidate) =>
              onChange({
                lat: roundCoord(candidate.lat),
                lng: roundCoord(candidate.lng),
                matchedLabel: candidate.label,
                confidence: candidate.confidence,
                status: "manual",
              })
            }
          />

          {/* The two coordinate boxes and the button that fills them from the
              map belong on one line — they are three ways of answering the same
              question, and stacking them read as three unrelated controls. */}
          <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
            <div className="min-w-0 flex-1">
              <CoordinateFields
                lat={draft.lat}
                lng={draft.lng}
                onChange={(coords) => onChange({ ...coords, status: "manual" })}
              />
            </div>

            <Button
              className="shrink-0"
              variant={isPlacing ? "secondary" : "tertiary"}
              onPress={onTogglePlacing}
            >
              {isPlacing ? "Click the map to place it" : "Place on map"}
            </Button>
          </div>

          <RowIssues issues={contactIssues} />
        </div>
      ) : (
        <RowIssues issues={draft.issues} className="mt-1 pl-8" />
      )}
    </motion.li>
  );
}
