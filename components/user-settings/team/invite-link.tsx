"use client";

import { Button, Input, Label, TextField } from "@heroui/react";
import { Copy } from "lucide-react";

import { copyText } from "@/components/ui/copy-text";

/**
 * An invite link, readable and copyable. Read-only rather than plain text so it
 * can be selected in one go on a phone, where Copy may be refused.
 */
export function InviteLink({ url }: { url: string }) {
  return (
    <div className="flex items-end gap-2">
      <TextField fullWidth isReadOnly value={url}>
        <Label>Invite link</Label>
        <Input className="font-mono text-xs" />
      </TextField>
      <Button
        variant="secondary"
        aria-label="Copy invite link"
        onPress={() => void copyText(url, "Invite link")}
        className="shrink-0"
      >
        <Copy aria-hidden="true" className="size-4" />
        Copy
      </Button>
    </div>
  );
}
