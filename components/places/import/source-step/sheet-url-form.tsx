"use client";

import { Button, Input, Label, TextField } from "@heroui/react";
import { useState } from "react";

import { parseSheetUrl, type SheetReference } from "@/lib/import/sheet-url";
import { toastProblem } from "@/lib/query/toast-error";

/** How to make a sheet readable by link, one move per line. */
const SHARE_STEPS: readonly { before: string; strong: string }[] = [
  { before: "In Google Sheets, press ", strong: "Share" },
  { before: "Set General access to ", strong: "Anyone with the link" },
  { before: "Keep the role as ", strong: "Viewer" },
];

/**
 * Paste a Google Sheets link.
 *
 * The link is parsed here rather than on the server, and it has to be: the sheet
 * tab lives in the URL fragment (`#gid=…`), which a browser never sends. A server
 * that took the whole URL would quietly import the first tab of every workbook.
 *
 * **A bad link is a toast, and the field only turns red.** A `FieldError` under
 * the input grew the form by a line, which — in a panel sharing its height with
 * the file panel and a step centred down the page — moved everything on screen.
 * The field keeps `isInvalid` so the red border and `aria-invalid` still point
 * at what to fix; the toast region is a live region, so the reason is still
 * announced.
 */
export function SheetUrlForm({
  isBusy,
  onSubmit,
}: {
  isBusy: boolean;
  onSubmit: (reference: SheetReference) => void;
}) {
  const [url, setUrl] = useState("");
  const [isInvalid, setIsInvalid] = useState(false);

  const submit = () => {
    const result = parseSheetUrl(url);

    if (!result.ok) {
      setIsInvalid(true);
      toastProblem("That link won't work", result.message);
      return;
    }

    setIsInvalid(false);
    onSubmit(result.reference);
  };

  return (
    <form
      className="flex h-full flex-col justify-center gap-5 rounded-xl border border-border px-5 py-5"
      noValidate
      onSubmit={(event) => {
        event.preventDefault();
        submit();
      }}
    >
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
        <TextField
          fullWidth
          className="min-w-0 flex-1"
          isInvalid={isInvalid}
          type="url"
          value={url}
          onChange={(value) => {
            setUrl(value);
            if (isInvalid) setIsInvalid(false);
          }}
        >
          <Label>Google Sheets link</Label>
          <Input placeholder="https://docs.google.com/spreadsheets/d/…" />
        </TextField>

        <Button
          type="submit"
          className="shrink-0"
          isPending={isBusy}
          isDisabled={!url.trim()}
        >
          Read sheet
        </Button>
      </div>

      <div className="space-y-2">
        <p className="text-xs font-medium text-foreground">
          Make the sheet readable by link
        </p>

        <ol className="space-y-1.5">
          {SHARE_STEPS.map((step, index) => (
            <li
              key={step.strong}
              className="flex items-center gap-2.5 text-xs text-muted"
            >
              <span
                aria-hidden="true"
                className="grid size-5 shrink-0 place-items-center rounded-full border border-border text-[10px] font-semibold tabular-nums"
              >
                {index + 1}
              </span>
              <span>
                {step.before}
                <span className="font-medium text-foreground">{step.strong}</span>
              </span>
            </li>
          ))}
        </ol>

        <p className="pt-1 text-xs text-muted">
          We read it now, and daily if you keep the map in sync.
        </p>
      </div>
    </form>
  );
}
