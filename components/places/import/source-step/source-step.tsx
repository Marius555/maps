"use client";

import { useState } from "react";

import { formatCount } from "@/lib/format/number";
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
     * No panel. The step is the control.
     *
     * This used to be a `SectionPanel` titled "Where are your locations?", which
     * put a white card on a grey page and a grey dropzone inside the card —
     * three grounds deep for one file picker, and the innermost of them
     * (`--surface-secondary`, 96%) is actually *darker* than the page it was
     * meant to echo (97.5%). The title said what `ImportSteps` already says
     * directly above it, and the description is a fact about the file, so it
     * belongs with the file picker rather than in a header.
     *
     * No width of its own. The wizard caps the Source step, so the tab strip,
     * the dropzone, the notes below them and the step trail above them are one
     * column by construction — a second, narrower cap here is what used to
     * leave the trail hanging off to the left of the tabs.
     */
    <div className="space-y-4">
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
          worst possible moment to learn it. The row cap moved here from the
          panel description it used to sit in — same two facts about the file,
          now on one line beside each other. */}
      <p className="text-xs text-muted">
        One row per location, up to {formatCount(MAX_SOURCE_ROWS)} rows.{" "}
        {remaining === 0
          ? `Your ${headroom.plan} plan is full at ${formatCount(headroom.limit)} locations. Upgrade, or remove some before importing.`
          : `You can add ${formatCount(remaining)} more ${remaining === 1 ? "location" : "locations"} on your ${headroom.plan} plan.`}
      </p>
    </div>
  );
}
