"use client";

import { Alert, Button } from "@heroui/react";
import { Columns2 } from "lucide-react";
import { AnimatePresence, motion } from "motion/react";
import { useMemo, useState } from "react";

import {
  COLLAPSE_CLASS,
  collapseMotion,
} from "@/components/ui/list-row-motion";
import { formatCount } from "@/lib/format/number";
import { validateColumnMapping } from "@/lib/import/column-mapping";
import { looksSwapped } from "@/lib/import/coordinates";
import { buildDraftPlaces } from "@/lib/import/draft-places";
import { rebuildSource } from "@/lib/import/read-source";
import { canSplitLatLng } from "@/lib/import/split-latlng";
import type { HeaderRowChoice } from "@/lib/import/table";
import { useImportStore } from "@/lib/stores/import-store";
import { ColumnTable } from "./column-table/column-table";
import { HeaderRowDialog } from "./header-row-dialog";
import { SwapCoordsBanner } from "./swap-coords-banner";

/**
 * Step 2: confirm which column is which.
 *
 * One table — the file, with our reading of it across the top — rather than a
 * banded grid of fourteen pickers with a read-only preview underneath. Both were
 * asking the same question; only the preview was asking it in the user's terms,
 * and it was at the bottom.
 *
 * The modal that used to open over this step is gone with them. It existed to
 * ask about fields we couldn't work out, but it could only ask against the
 * column names that had already failed to answer, and its own question was
 * unanswerable in a file whose headers are "Column A".."Column I". An em dash
 * over three rows of real values asks it better, and asks it in place.
 */
export function MappingStep({ onContinue }: { onContinue: () => void }) {
  const headers = useImportStore((state) => state.headers);
  const rows = useImportStore((state) => state.rows);
  const mapping = useImportStore((state) => state.mapping);
  const fileName = useImportStore((state) => state.fileName);
  const truncated = useImportStore((state) => state.truncated);
  const repeatedHeaderRows = useImportStore((state) => state.repeatedHeaderRows);
  const loaded = useImportStore((state) => state.loaded);
  const headerRowIndex = useImportStore((state) => state.headerRowIndex);
  const splitNotice = useImportStore((state) => state.splitNotice);
  const splitLatLng = useImportStore((state) => state.splitLatLng);
  const swapLatLng = useImportStore((state) => state.swapLatLng);
  const setDrafts = useImportStore((state) => state.setDrafts);
  const setSource = useImportStore((state) => state.setSource);

  const [isPickingHeader, setIsPickingHeader] = useState(false);

  const problems = useMemo(
    () => validateColumnMapping(mapping, headers),
    [mapping, headers],
  );

  /*
   * Offered only where it would actually produce something. A column of "n/a"
   * mapped to the combined field would otherwise get a button that deletes it.
   * At most one column can hold `latlng` — the picker and the detector both
   * enforce one field per column — so naming it in a sentence is unambiguous.
   */
  const splittable = useMemo(() => {
    const header = mapping.latlng;
    if (!header) return null;

    return canSplitLatLng(rows, header) ? header : null;
  }, [mapping.latlng, rows]);

  const swapped = useMemo(() => {
    if (!mapping.lat || !mapping.lng) return false;

    return looksSwapped(
      rows.slice(0, 50).map((row) => ({
        lat: row[mapping.lat as string] ?? "",
        lng: row[mapping.lng as string] ?? "",
      })),
    );
  }, [mapping.lat, mapping.lng, rows]);

  /**
   * Re-read the file against a different header row.
   *
   * Everything downstream is derived from the mapping, so `setSource` resetting
   * the wizard is the point rather than a side effect — a mapping made against
   * the old column names describes columns that no longer exist, and so do any
   * cell edits made against them.
   */
  const onChooseHeaderRow = (choice: HeaderRowChoice) => {
    if (!loaded) return;

    setSource(rebuildSource(loaded, choice));
  };

  const onNext = () => {
    if (problems.length > 0) return;

    setDrafts(buildDraftPlaces(rows, mapping));
    onContinue();
  };

  return (
    /*
     * No `SectionPanel`. The table is the step, and it used to sit inside a
     * white card on a grey page with its own grey header strip inside that —
     * three grounds for one table, the innermost of them darker than the page
     * it was echoing. It now sits on the page the way the locations table does.
     */
    <div className="space-y-4">
      <p className="text-xs text-muted">
        {describe({
          fileName,
          rowCount: rows.length,
          truncated,
          repeatedHeaderRows,
        })}
      </p>

      {/*
       * Continue sits above the table, not in a footer under it.
       *
       * The table is as tall as the file, so a button beneath it was several
       * screens below the thing it acts on: you read our reading of the columns,
       * scrolled past three thousand rows, and pressed a button whose reason you
       * could no longer see. On the header-row line it is beside the last fact
       * you need before deciding.
       */}
      <div className="flex flex-wrap items-center gap-3">
        {/* Stated in words rather than left implicit, because when the guess is
            wrong this line is the only thing on screen that explains why every
            column is headed with something nonsensical. */}
        {loaded ? (
          <p className="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1 text-xs text-muted">
            {headerRowIndex === null
              ? "No header row found — we named the columns ourselves."
              : `Using row ${headerRowIndex + 1} as your column names.`}
            <Button
              size="sm"
              variant="ghost"
              onPress={() => setIsPickingHeader(true)}
            >
              Change
            </Button>
          </p>
        ) : null}

        {/* `ml-auto` rather than `justify-between`: with no header-row line to
            sit opposite, `justify-between` would leave this at the left edge. */}
        <Button
          className="ml-auto"
          isDisabled={problems.length > 0}
          onPress={onNext}
        >
          Continue
        </Button>
      </div>

      {/*
       * Warnings sit with the button they disable.
       *
       * They used to be under the table, and the rule behind that has not
       * changed: they belong between the evidence and the button, which is where
       * the decision is actually made. The button has moved above the table, so
       * they moved with it. What must not happen either way is the old failure —
       * the complaint two scroll positions from the control it explains, so you
       * fix a column and have nothing left on screen telling you whether it
       * worked.
       *
       * One stable wrapper around the whole `AnimatePresence`, and the gap
       * carried as padding inside each block: this column is
       * `space-y-4`, and a margin does not collapse with an animated height, so
       * a warning that left would take its height with it and leave its 1rem
       * behind. `empty:hidden` is what keeps that wrapper from claiming a
       * `space-y` gap of its own on the usual case, where there is nothing wrong.
       */}
      <div className="empty:hidden">
        <AnimatePresence initial={false}>
          {problems.length > 0 ? (
            <motion.div
              key="problems"
              {...collapseMotion()}
              className={COLLAPSE_CLASS}
            >
              <Alert status="danger">
                <Alert.Indicator />
                <Alert.Content>
                  <Alert.Title>
                    {problems.length === 1
                      ? "One thing to sort out"
                      : `${problems.length} things to sort out`}
                  </Alert.Title>
                  {/* One description per problem rather than a list:
                      Alert.Description is a span, and a <ul> inside phrasing
                      content is invalid. */}
                  {problems.map((problem) => (
                    <Alert.Description key={problem.message}>
                      {problem.message}
                    </Alert.Description>
                  ))}
                </Alert.Content>
              </Alert>
            </motion.div>
          ) : null}

          {swapped ? (
            <motion.div
              key="swapped"
              {...collapseMotion()}
              className={COLLAPSE_CLASS}
            >
              <SwapCoordsBanner onSwap={swapLatLng} />
            </motion.div>
          ) : null}
        </AnimatePresence>
      </div>

      {/* Same shape as the header-row line above: a fact about the file, and the
          single action on it. The button keeps its name into the notice it
          leaves behind, so what you pressed is what you're told happened. */}
      {splittable ? (
        <p className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-muted">
          &ldquo;{splittable}&rdquo; holds both coordinates in one column.
          <Button
            size="sm"
            variant="ghost"
            onPress={() => splitLatLng(splittable)}
          >
            <Columns2 aria-hidden="true" className="size-3.5" />
            Split into Latitude and Longitude
          </Button>
        </p>
      ) : null}

      {splitNotice ? (
        <p role="status" className="text-xs text-muted">
          Split into {splitNotice.latHeader} and {splitNotice.lngHeader}.
          {splitNotice.unparsed > 0
            ? ` ${formatCount(splitNotice.unparsed)} ${
                splitNotice.unparsed === 1 ? "row" : "rows"
              } couldn't be read — those cells are empty.`
            : ""}
        </p>
      ) : null}

      <ColumnTable />


      {loaded ? (
        <HeaderRowDialog
          cells={loaded.source.cells}
          current={headerRowIndex}
          isOpen={isPickingHeader}
          onOpenChange={setIsPickingHeader}
          onChoose={onChooseHeaderRow}
        />
      ) : null}
    </div>
  );
}

function describe({
  fileName,
  rowCount,
  truncated,
  repeatedHeaderRows,
}: {
  fileName: string | null;
  rowCount: number;
  truncated: boolean;
  repeatedHeaderRows: number;
}): string {
  const parts = [`${fileName} — ${formatCount(rowCount)} rows.`];

  if (truncated) parts.push("Only the first rows will be imported.");

  if (repeatedHeaderRows > 0) {
    parts.push(
      `We dropped ${formatCount(repeatedHeaderRows)} ${
        repeatedHeaderRows === 1 ? "row that repeated" : "rows that repeated"
      } your column names.`,
    );
  }

  parts.push("Rename a column with the chevron, or edit any cell.");

  return parts.join(" ");
}
