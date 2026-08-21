"use client";

import { useState } from "react";

import { ErrorMessage } from "@/components/ui/error-message";
import { SectionPanel } from "@/components/ui/section-panel";
import { formatCount } from "@/lib/format/number";
import { MAX_SOURCE_ROWS } from "@/lib/import/limits";
import { finishSource, readFile, type LoadedSource } from "@/lib/import/read-source";
import { readGoogleSheet } from "@/lib/import/sources/google-sheet";
import { ImportSourceError } from "@/lib/import/sources/types";
import type { SheetReference } from "@/lib/import/sheet-url";
import { ApiError } from "@/lib/query/fetcher";
import { useImportStore } from "@/lib/stores/import-store";
import { FileDrop } from "./file-drop";
import { SheetPicker } from "./sheet-picker";
import { SheetUrlForm } from "./sheet-url-form";
import { SourceTabs, type SourceTab } from "./source-tabs";

/**
 * Step 1: where the locations come from.
 *
 * Parsing happens in the browser for every source except a Google Sheet, which
 * needs a server hop only because Google sends no CORS headers. So a wrong file
 * costs a re-pick and never a round trip, and we never keep a copy of a
 * customer's spreadsheet.
 */
export function SourceStep({
  mapId,
  headroom,
}: {
  mapId: string;
  headroom: { plan: string; limit: number; used: number };
}) {
  const setSource = useImportStore((state) => state.setSource);

  const [tab, setTab] = useState<SourceTab>("file");
  const [error, setError] = useState<unknown>(null);
  const [isBusy, setIsBusy] = useState(false);

  // Kept so switching sheets can re-read the same workbook without a re-pick.
  const [workbook, setWorkbook] = useState<{
    file: File;
    sheetNames: string[];
    sheetName: string;
  } | null>(null);

  const remaining = Math.max(headroom.limit - headroom.used, 0);

  const load = async (read: () => Promise<LoadedSource>) => {
    setError(null);
    setIsBusy(true);

    try {
      setSource(await read());
    } catch (cause) {
      setError(
        cause instanceof ImportSourceError || cause instanceof ApiError
          ? cause.message
          : "We couldn't read that. Export your locations as CSV and try again.",
      );
    } finally {
      setIsBusy(false);
    }
  };

  const onPickFile = (file: File) =>
    void load(async () => {
      const loaded = await readFile(file);

      if (loaded.sheetNames && loaded.sheetNames.length > 1) {
        setWorkbook({
          file,
          sheetNames: loaded.sheetNames,
          sheetName: loaded.sheetNames[0],
        });
      } else {
        setWorkbook(null);
      }

      return loaded;
    });

  const onPickSheet = (sheetName: string) => {
    if (!workbook) return;

    setWorkbook({ ...workbook, sheetName });
    void load(() => readFile(workbook.file, { sheetName }));
  };

  const onPickGoogleSheet = (reference: SheetReference) =>
    void load(async () =>
      finishSource(await readGoogleSheet(mapId, reference), "google-sheet"),
    );

  return (
    <SectionPanel
      title="Where are your locations?"
      description={`One row per location. Up to ${formatCount(MAX_SOURCE_ROWS)} rows.`}
    >
      <SourceTabs
        current={tab}
        onChange={setTab}
        filePanel={<FileDrop isBusy={isBusy} onPick={onPickFile} />}
        sheetPanel={
          <SheetUrlForm isBusy={isBusy} onSubmit={onPickGoogleSheet} />
        }
      />

      {workbook ? (
        <SheetPicker
          sheetNames={workbook.sheetNames}
          current={workbook.sheetName}
          isBusy={isBusy}
          onChange={onPickSheet}
        />
      ) : null}

      {/* Said here rather than at the end, because finding out after a
          ten-minute address lookup that the file was never going to fit is the
          worst possible moment to learn it. */}
      <p className="text-xs text-muted">
        {remaining === 0
          ? `Your ${headroom.plan} plan is full at ${formatCount(headroom.limit)} locations. Upgrade, or remove some before importing.`
          : `You can add ${formatCount(remaining)} more ${remaining === 1 ? "location" : "locations"} on your ${headroom.plan} plan.`}
      </p>

      {error ? <ErrorMessage error={error} /> : null}
    </SectionPanel>
  );
}
