"use client";

import { Button } from "@heroui/react";
import { FileSpreadsheet } from "lucide-react";
import { useRef, useState } from "react";

import { ErrorMessage } from "@/components/ui/error-message";
import { SectionPanel } from "@/components/ui/section-panel";

import { detectColumnMapping } from "@/lib/csv/column-mapping";
import { CsvParseError, MAX_CSV_ROWS, parseCsvFile } from "@/lib/csv/parse";
import { useImportStore } from "@/lib/stores/import-store";

/**
 * Step 1: pick a file.
 *
 * Parsing happens here in the browser, so a wrong file costs a re-pick and never
 * a round trip. The detected mapping is computed immediately and confirmed on the
 * next step — never applied silently.
 */
export function FileStep() {
  const input = useRef<HTMLInputElement>(null);
  const setFile = useImportStore((state) => state.setFile);
  const [error, setError] = useState<string | null>(null);
  const [isParsing, setIsParsing] = useState(false);

  const onPick = async (file: File | undefined) => {
    if (!file) return;

    setError(null);
    setIsParsing(true);

    try {
      const parsed = await parseCsvFile(file);

      setFile({
        fileName: file.name,
        headers: parsed.headers,
        rows: parsed.rows,
        truncated: parsed.truncated,
        mapping: detectColumnMapping(parsed.headers),
      });
    } catch (cause) {
      setError(
        cause instanceof CsvParseError
          ? cause.message
          : "We couldn't read that file. Export it as CSV and try again.",
      );
    } finally {
      setIsParsing(false);
    }
  };

  return (
    <SectionPanel
      title="Choose a CSV file"
      description={`One row per location, with a header row naming each column. Up to ${MAX_CSV_ROWS.toLocaleString()} rows.`}
    >
      {/* No dashed border: nothing here accepts a drop, so a dropzone frame
          would promise an interaction that doesn't exist. */}
      <div className="flex flex-col items-center gap-3 rounded-xl bg-surface-secondary px-6 py-10 text-center">
        <span
          aria-hidden="true"
          className="grid size-11 place-items-center rounded-full bg-default text-muted"
        >
          <FileSpreadsheet className="size-5" />
        </span>

        <input
          ref={input}
          type="file"
          className="sr-only"
          accept=".csv,text/csv"
          onChange={(event) => {
            void onPick(event.target.files?.[0]);
            event.target.value = "";
          }}
        />

        <Button isPending={isParsing} onPress={() => input.current?.click()}>
          Choose file
        </Button>

        <p className="max-w-xs text-pretty text-xs text-muted">
          Your file is read in your browser. Nothing is saved until you confirm.
        </p>
      </div>

      {error ? <ErrorMessage error={error} /> : null}
    </SectionPanel>
  );
}
