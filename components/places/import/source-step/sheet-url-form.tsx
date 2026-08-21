"use client";

import { Button, FieldError, Input, Label, TextField } from "@heroui/react";
import { useState } from "react";

import { parseSheetUrl, type SheetReference } from "@/lib/import/sheet-url";

/**
 * Paste a Google Sheets link.
 *
 * The link is parsed here rather than on the server, and it has to be: the sheet
 * tab lives in the URL fragment (`#gid=…`), which a browser never sends. A server
 * that took the whole URL would quietly import the first tab of every workbook.
 */
export function SheetUrlForm({
  isBusy,
  onSubmit,
}: {
  isBusy: boolean;
  onSubmit: (reference: SheetReference) => void;
}) {
  const [url, setUrl] = useState("");
  const [error, setError] = useState<string | null>(null);

  const submit = () => {
    const result = parseSheetUrl(url);

    if (!result.ok) {
      setError(result.message);
      return;
    }

    setError(null);
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
        isInvalid={Boolean(error)}
        type="url"
        value={url}
        onChange={(value) => {
          setUrl(value);
          if (error) setError(null);
        }}
      >
        <Label>Google Sheets link</Label>
        <Input />
        {error ? <FieldError>{error}</FieldError> : null}
      </TextField>

      <div className="rounded-lg bg-surface-secondary px-4 py-3">
        <p className="text-xs text-muted">
          The sheet has to be readable by anyone with the link. In Google Sheets:{" "}
          <span className="text-foreground">Share</span> →{" "}
          <span className="text-foreground">General access</span> →{" "}
          <span className="text-foreground">Anyone with the link</span> →{" "}
          <span className="text-foreground">Viewer</span>. We read it once, now.
        </p>
      </div>

      <Button type="submit" isPending={isBusy} isDisabled={!url.trim()}>
        Read sheet
      </Button>
    </form>
  );
}
