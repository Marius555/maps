"use client";

import { Button, Input, Label, TextField } from "@heroui/react";
import { useState } from "react";

import { parseSheetUrl, type SheetReference } from "@/lib/import/sheet-url";
import { toastProblem } from "@/lib/query/toast-error";

/**
 * Paste a Google Sheets link.
 *
 * The link is parsed here rather than on the server, and it has to be: the sheet
 * tab lives in the URL fragment (`#gid=…`), which a browser never sends. A server
 * that took the whole URL would quietly import the first tab of every workbook.
 *
 * **A bad link is a toast, and the field only turns red.** The sentence used to
 * be a `FieldError` under the input, and it grew the form by a line — which, in
 * a panel sharing its height with the file tab and a step centred down the page,
 * moved everything on screen. The field keeps `isInvalid` so the red border and
 * `aria-invalid` still point at what to fix; the toast region is a live region,
 * so the reason is still announced.
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
      className="space-y-4"
      noValidate
      onSubmit={(event) => {
        event.preventDefault();
        submit();
      }}
    >
      <TextField
        fullWidth
        isInvalid={isInvalid}
        type="url"
        value={url}
        onChange={(value) => {
          setUrl(value);
          if (isInvalid) setIsInvalid(false);
        }}
      >
        <Label>Google Sheets link</Label>
        <Input />
      </TextField>

      <div className="rounded-lg bg-surface-secondary px-4 py-3">
        <p className="text-xs text-muted">
          The sheet has to be readable by anyone with the link. In Google Sheets:{" "}
          <span className="text-foreground">Share</span> →{" "}
          <span className="text-foreground">General access</span> →{" "}
          <span className="text-foreground">Anyone with the link</span> →{" "}
          <span className="text-foreground">Viewer</span>. We read it now, and
          daily after that if you keep the map in sync.
        </p>
      </div>

      <Button type="submit" isPending={isBusy} isDisabled={!url.trim()}>
        Read sheet
      </Button>
    </form>
  );
}
