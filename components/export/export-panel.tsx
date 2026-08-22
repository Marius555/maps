"use client";

import { Button, Separator } from "@heroui/react";

import { ErrorMessage } from "@/components/ui/error-message";
import { SelectControl } from "@/components/ui/select-control";
import type { ExportFormat, ExportOptions } from "@/lib/export/export-map";
import {
  budgetError,
  layoutFor,
  paperById,
  PAPERS,
  qualityById,
  QUALITIES,
  type PaperId,
  type QualityId,
} from "@/lib/export/paper";

/**
 * Choose what the exported map looks like.
 *
 * Prop-driven and stateless, the way `components/appearance/appearance-panel.tsx`
 * is, so the toolbar's popover is not the only place it can live — a Settings tab
 * or a share dialog could render the same panel without any of this moving.
 *
 * Three choices and a sentence. The sentence is the point: a page size and a
 * quality are abstract until you see what they multiply out to, and "3509 × 2481
 * pixels" is the thing that tells someone whether this will do for a poster. It
 * is also where a combination too large for the browser says so — before the
 * button, not after it, which is the same rule the import preview follows about
 * plan limits.
 */
export function ExportPanel({
  value,
  view,
  isBusy,
  error,
  onChange,
  onExport,
}: {
  value: ExportOptions;
  /** The live map's size in CSS pixels, for the "same shape" option. */
  view: { width: number; height: number };
  isBusy: boolean;
  error?: string | null;
  onChange: (options: ExportOptions) => void;
  onExport: () => void;
}) {
  const paper = paperById(value.paper);
  const quality = qualityById(value.quality);
  const layout = layoutFor(paper, quality.dpi, view);
  const refusal = budgetError(layout);

  return (
    <div className="flex w-72 max-w-[calc(100vw-2rem)] flex-col gap-3">
      <Field label="Format" name="export-format">
        <Choices
          name="export-format"
          options={FORMATS}
          value={value.format}
          onChange={(format) => onChange({ ...value, format })}
        />
      </Field>

      {/* A select rather than a third row of buttons: six page sizes will not fit
          across a popover, and this is the one choice with a long list. */}
      <SelectControl
        label="Page"
        value={value.paper}
        options={PAPERS.map((option) => ({ id: option.id, label: option.label }))}
        onChange={(paper) => onChange({ ...value, paper: paper as PaperId })}
      />

      <Field label="Quality" name="export-quality">
        <Choices
          name="export-quality"
          options={QUALITIES.map((option) => ({
            value: option.id,
            label: option.label,
          }))}
          value={value.quality}
          onChange={(id) => onChange({ ...value, quality: id as QualityId })}
        />
        <p className="mt-1 text-xs text-muted">{quality.hint}</p>
      </Field>

      <Separator />

      <p className="text-xs text-muted">
        {formatPixels(layout.width)} × {formatPixels(layout.height)} pixels
        {paper.widthMm ? ` · ${paper.widthMm}×${paper.heightMm}mm at ${quality.dpi} DPI` : ""}
      </p>

      {refusal ? (
        <p className="rounded-lg bg-danger/10 px-3 py-2 text-xs text-danger">
          {refusal}
        </p>
      ) : null}

      {error ? <ErrorMessage error={error} /> : null}

      <Button
        size="sm"
        className="w-full"
        isPending={isBusy}
        isDisabled={Boolean(refusal)}
        onPress={onExport}
      >
        Export
      </Button>

      {/* Said once, quietly, rather than discovered when the file is opened.
          §12 makes the credit non-negotiable and it is drawn into the bitmap,
          so it is a thing about the file the user is about to get. */}
      <p className="text-xs text-muted">
        The map credit is drawn into the image. Everything happens in your
        browser — nothing is uploaded.
      </p>
    </div>
  );
}

const FORMATS: { value: ExportFormat; label: string }[] = [
  { value: "png", label: "PNG" },
  { value: "jpeg", label: "JPEG" },
  { value: "pdf", label: "PDF" },
];

function Field({
  label,
  name,
  children,
}: {
  label: string;
  /** Ties the heading to the group it labels, which has no control of its own. */
  name: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <p id={`${name}-label`} className="mb-1 text-sm font-medium text-foreground">
        {label}
      </p>
      {children}
    </div>
  );
}

/**
 * A row of mutually exclusive buttons.
 *
 * `radio` inputs rather than buttons, so arrow keys move between them and a
 * screen reader announces the group — and hidden behind labels so the row can be
 * styled. `relative` on each label is load-bearing: Tailwind's `sr-only` is
 * `position: absolute`, and without a positioned ancestor the hidden input lays
 * itself out against whatever is positioned further up. Inside a portalled
 * popover that is somewhere else entirely, and clicking one scrolls the page to
 * blank space below the app — the same trap `components/appearance/theme-gallery.tsx`
 * documents, and it bites the same way here.
 */
function Choices<T extends string>({
  name,
  options,
  value,
  onChange,
}: {
  /**
   * Shared by every input in the row, and load-bearing twice over: it is what
   * makes the browser treat them as one group — so arrow keys move between them
   * and only one can be checked — and what ties them to the heading above.
   */
  name: string;
  options: readonly { value: T; label: string }[];
  value: T;
  onChange: (value: T) => void;
}) {
  return (
    <div
      role="radiogroup"
      aria-labelledby={`${name}-label`}
      className="flex gap-1 rounded-lg bg-surface-secondary p-0.5"
    >
      {options.map((option) => (
        <label
          key={option.value}
          className={`relative flex-1 cursor-pointer rounded-md px-2 py-1 text-center text-sm transition-colors ${
            option.value === value
              ? "bg-surface text-foreground shadow-sm"
              : "text-muted hover:text-foreground"
          }`}
        >
          <input
            type="radio"
            name={name}
            className="peer sr-only"
            checked={option.value === value}
            onChange={() => onChange(option.value)}
          />
          {option.label}
        </label>
      ))}
    </div>
  );
}

/** Grouped, so 3509 reads as a count rather than a year. */
function formatPixels(value: number): string {
  return value.toLocaleString("en-US");
}
