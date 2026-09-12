"use client";

import { Button, Input, Label, TextField } from "@heroui/react";
import { Crosshair, X } from "lucide-react";
import { AnimatePresence, motion } from "motion/react";
import { useEffect, useRef } from "react";

import { CoordinateFields } from "@/components/places/coordinate-fields";
import { AddressSearchField } from "@/components/places/place-form/address-search-field";
import { IconButton } from "@/components/ui/icon-button";
import {
  COLLAPSE_CLASS,
  collapseMotion,
} from "@/components/ui/list-row-motion";
import type { DraftPlace } from "@/lib/import/draft-places";
import { issuesFor } from "@/lib/import/issues";
import { formatCoords, roundCoord } from "@/lib/map/geo";
import { revealCollapse } from "@/lib/ui/reveal-fold";
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

  const rowRef = useRef<HTMLLIElement>(null);
  const foldRef = useRef<HTMLDivElement>(null);

  /*
   * Opening a row brings it into view, the way every fold in the app does.
   *
   * Pressing **Fix** near the bottom of the screen used to put four fields below
   * the fold — the gesture's whole result off screen, on a list whose rhythm is
   * "fix this one, look at the next". `revealCollapse` is `revealFoldIn`'s twin
   * for a Motion collapse; it drives the scroll on the same curve as the growth
   * rather than snapping after it, and it honours the `scroll-mt` below so the
   * row does not land behind the sticky map.
   *
   * On open only. A close takes the row's own height away beneath whatever is
   * being read, which is not a thing anybody needs moving for.
   */
  useEffect(() => {
    if (!isOpen) return;

    return revealCollapse(rowRef.current, foldRef.current);
  }, [isOpen]);

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
      ref={rowRef}
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.15, ease: [0, 0, 0.2, 1] }}
      /*
       * A hairline between rows, not a box around each one.
       *
       * Thirty bordered, rounded cards stacked with a gap read as thirty objects
       * to deal with. The locations table this step is a rehearsal for draws the
       * same list as rows separated by a rule, and scanning is the job on both
       * screens. Selection is a fill rather than an accent border for the same
       * reason — it marks a row without adding an edge to count.
       */
      /* `lg:scroll-mt-*` is what the reveal above aims at, and the number is the
         sticky map's: `lg:top-4` plus `lg:h-[min(24rem,40vh)]` in review-step.tsx,
         plus the `space-y-3` between them. Without it a revealed row lands under
         the map, which is the whole reason that element caps its own height. */
      className={`border-t border-border px-2 py-1.5 transition-colors lg:scroll-mt-[calc(min(24rem,40vh)+1.75rem)] ${
        isSelected ? "bg-accent-soft" : ""
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

      {/*
       * Opening and closing is a fold, not a cut.
       *
       * It used to be a bare ternary, so pressing Fix replaced one line with a
       * block of four fields in a single frame and every row below jumped down
       * the page. On a list whose whole gesture is "fix this one, look at the
       * next", that reads as the list reordering itself rather than as one row
       * opening. `collapseMotion` is the app's own fold and the same pair
       * `mapping-step.tsx` uses. `prefers-reduced-motion` needs no guard: the
       * blanket rule in globals.css already clamps every transition to 0.01ms,
       * and the open state is four fields on screen rather than something told
       * only in motion.
       *
       * One stable `empty:hidden` wrapper around the whole `AnimatePresence`,
       * with the gap carried as padding *inside* each block (`COLLAPSE_CLASS`) —
       * a margin does not collapse with an animated height, so a block that left
       * would take its height and leave its gap behind. Both branches are
       * conditional rather than one being the other's `else`, so a tidy closed
       * row renders nothing at all here and the wrapper really is empty.
       */}
      <div className="empty:hidden">
        <AnimatePresence initial={false}>
          {isOpen ? (
            <motion.div
              key="open"
              ref={foldRef}
              {...collapseMotion()}
              className={COLLAPSE_CLASS}
            >
              {/*
               * `pl-8` is the row's own indent. The `<li>`'s `px-2` (8px) plus
               * the row number's `w-6` plus the `gap-x-2` beside it puts the
               * location's name 40px in, and 8 + 32 lands on the same pixel. At
               * the `px-1` this used to carry, every field started 28px to the
               * left of the heading it belonged to — the closed row's issue list
               * was already using this exact `pl-8`, which is why that half
               * lined up and this half did not.
               *
               * `max-w-3xl` because Review runs the full width of the page: a
               * two-column grid of that gives Name and Address around 900px each
               * on a wide monitor, which is a paragraph-length box for a shop
               * name.
               */}
              <div className="max-w-3xl space-y-3 pl-8 pr-1 pt-3">
                <div className="grid gap-2 sm:grid-cols-2">
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
                      // Chosen deliberately, so it stops being a geocoder guess
                      // and stops being flagged — the same rule the editor's
                      // form applies.
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

                <RowIssues
                  issues={[
                    ...issuesFor(draft.issues, "name"),
                    ...placementIssues,
                  ]}
                />

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

                {/*
                 * The two coordinate boxes and the button that fills them from
                 * the map belong on one line — they are three ways of answering
                 * the same question, and stacking them read as three unrelated
                 * controls.
                 *
                 * The pair is sized to what it holds rather than to the row.
                 * `-122.4194` is nine characters; it had a `flex-1` half of a
                 * full-width table row, split two ways, to show them in.
                 */}
                <div className="flex flex-col gap-2 sm:flex-row sm:items-end">
                  <CoordinateFields
                    className="grid shrink-0 grid-cols-2 gap-2 sm:w-[17rem]"
                    lat={draft.lat}
                    lng={draft.lng}
                    onChange={(coords) =>
                      onChange({ ...coords, status: "manual" })
                    }
                  />

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
            </motion.div>
          ) : null}

          {!isOpen && draft.issues.length > 0 ? (
            <motion.div
              key="closed"
              {...collapseMotion()}
              className={COLLAPSE_CLASS}
            >
              <RowIssues issues={draft.issues} className="pl-8 pt-1" />
            </motion.div>
          ) : null}
        </AnimatePresence>
      </div>
    </motion.li>
  );
}
