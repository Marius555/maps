"use client";

import { useState } from "react";

import { MAX_SOURCE_ROWS } from "@/lib/import/limits";
import { finishSource, readFile, type LoadedSource } from "@/lib/import/read-source";
import { readGoogleSheet } from "@/lib/import/sources/google-sheet";
import { ImportSourceError } from "@/lib/import/sources/types";
import type { SheetReference } from "@/lib/import/sheet-url";
import { toastProblem } from "@/lib/query/toast-error";
import { useImportStore } from "@/lib/stores/import-store";
import { FileDrop } from "./file-drop";
import { SheetPicker } from "./sheet-picker";
import { SheetUrlForm } from "./sheet-url-form";
import { SourceChoice, type SourceTab } from "./source-choice";
import { SourceFacts } from "./source-facts";

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
  const [isBusy, setIsBusy] = useState(false);

  // Kept so switching sheets can re-read the same workbook without a re-pick.
  const [workbook, setWorkbook] = useState<{
    file: File;
    sheetNames: string[];
    sheetName: string;
  } | null>(null);

  const remaining = Math.max(headroom.limit - headroom.used, 0);

  /**
   * Read a source, or say why it couldn't be read.
   *
   * A failure is a toast, not an alert under the tabs: it reports the press that
   * just happened, and an alert appearing there pushed the whole centred step
   * up by half its height. The message itself is still whoever raised it —
   * `ImportSourceError` and the sheet route both write user-facing sentences.
   */
  const load = async (
    title: string,
    read: () => Promise<LoadedSource>,
  ) => {
    setIsBusy(true);

    try {
      setSource(await read());
    } catch (cause) {
      toastProblem(
        title,
        cause instanceof ImportSourceError ? cause.message : cause,
        "We couldn't read that. Export your locations as CSV and try again.",
      );
    } finally {
      setIsBusy(false);
    }
  };

  const onPickFile = (file: File) =>
    void load("Couldn't read the file", async () => {
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
    void load("Couldn't read that sheet", () =>
      readFile(workbook.file, { sheetName }),
    );
  };

  const onPickGoogleSheet = (reference: SheetReference) =>
    void load("Couldn't read the Google Sheet", async () => ({
      ...finishSource(await readGoogleSheet(mapId, reference), "google-sheet"),
      // Kept so the import can link the map to this sheet and keep it in sync.
      sheet: reference,
    }));

  return (
    /*
     * No panel around the step: it sits on the page (one ground per screen —
     * see the Surfaces notes in docs/notes/editor-and-layout.md).
     *
     * No width of its own. The wizard caps the Source step, so the title above,
     * the cards, the panel and the notes below them are one column by
     * construction.
     */
    <div className="space-y-5">
      <SourceChoice
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
      <SourceFacts
        maxRows={MAX_SOURCE_ROWS}
        plan={headroom.plan}
        limit={headroom.limit}
        remaining={remaining}
      />
    </div>
  );
}
