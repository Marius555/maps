"use client";

import { Button } from "@heroui/react";
import { useMemo } from "react";

import { ErrorMessage } from "@/components/ui/error-message";
import { SectionPanel } from "@/components/ui/section-panel";
import { SelectControl } from "@/components/ui/select-control";
import { validateColumnMapping } from "@/lib/csv/column-mapping";
import { buildDraftPlaces } from "@/lib/csv/draft-places";
import {
  FIELD_LABELS,
  IMPORT_FIELDS,
  REQUIRED_FIELDS,
  type ImportField,
} from "@/lib/csv/fields";
import { useImportStore } from "@/lib/stores/import-store";

const UNMAPPED = "__unmapped";

/**
 * Step 2: confirm which column is which.
 *
 * Every field is listed, pre-filled with the detected guess, so nothing is
 * imported on the strength of a match the user never saw.
 */
export function MappingStep({ onContinue }: { onContinue: () => void }) {
  const headers = useImportStore((state) => state.headers);
  const rows = useImportStore((state) => state.rows);
  const mapping = useImportStore((state) => state.mapping);
  const fileName = useImportStore((state) => state.fileName);
  const truncated = useImportStore((state) => state.truncated);
  const setMappingField = useImportStore((state) => state.setMappingField);
  const setDrafts = useImportStore((state) => state.setDrafts);

  const problems = useMemo(
    () => validateColumnMapping(mapping, headers),
    [mapping, headers],
  );

  const problemByField = new Map(
    problems.filter((problem) => problem.field).map((p) => [p.field, p.message]),
  );
  const generalProblems = problems.filter((problem) => !problem.field);

  const options = [
    { id: UNMAPPED, label: "Don't import" },
    ...headers.map((header) => ({ id: header, label: header })),
  ];

  const preview = rows.slice(0, 3);

  const onNext = () => {
    if (problems.length > 0) return;

    const { drafts, skippedBlankRows } = buildDraftPlaces(rows, mapping);
    setDrafts(drafts, skippedBlankRows);
    onContinue();
  };

  return (
    <SectionPanel
      title="Map your columns"
      description={`${fileName} — ${rows.length.toLocaleString()} rows. ${
        truncated ? "Only the first rows will be imported. " : ""
      }We've guessed these from your headers. Change anything that looks wrong.`}
      footer={
        <Button isDisabled={problems.length > 0} onPress={onNext}>
          Continue
        </Button>
      }
    >
      {generalProblems.map((problem) => (
        <ErrorMessage key={problem.message} error={problem.message} />
      ))}

      <div className="grid gap-4 sm:grid-cols-2">
        {IMPORT_FIELDS.map((field) => (
          <div key={field} className="space-y-1">
            <SelectControl
              label={`${FIELD_LABELS[field]}${isRequired(field) ? " (required)" : ""}`}
              options={options}
              value={mapping[field] ?? UNMAPPED}
              error={problemByField.get(field)}
              onChange={(value) =>
                setMappingField(field, value === UNMAPPED ? undefined : value)
              }
            />

            <ColumnSample header={mapping[field]} rows={preview} />
          </div>
        ))}
      </div>

    </SectionPanel>
  );
}

function isRequired(field: ImportField): boolean {
  return (REQUIRED_FIELDS as readonly ImportField[]).includes(field);
}

/**
 * The first few values from the chosen column.
 *
 * This is what makes the mapping checkable: two columns called "Address 1" and
 * "Address 2" are indistinguishable by name and obvious by content.
 */
function ColumnSample({
  header,
  rows,
}: {
  header: string | undefined;
  rows: Record<string, string>[];
}) {
  if (!header) return null;

  const samples = rows
    .map((row) => (row[header] ?? "").trim())
    .filter(Boolean)
    .slice(0, 2);

  if (samples.length === 0) {
    return <p className="text-xs text-muted">This column looks empty.</p>;
  }

  return (
    <p className="truncate text-xs text-muted" title={samples.join(" · ")}>
      e.g. {samples.join(" · ")}
    </p>
  );
}
