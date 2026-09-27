"use client";

import { Button, Description, FieldError, Input, Label, TextField } from "@heroui/react";
import { Plus } from "lucide-react";
import { useState } from "react";

import { MAX_ALLOWED_DOMAINS, parseDomainEntries } from "@/lib/validation/domain.schema";

/**
 * One domain at a time, checked before it joins the list.
 *
 * It replaced a textarea, which accepted anything and only said what was wrong
 * on Save, as "Line 3: …" against a box the owner had to count down. Here a bad
 * entry never leaves the field: it stays in it with the reason underneath, and a
 * good one becomes a chip. A pasted list still works (`parseDomainEntries`) —
 * the good entries are added and only the refused ones are left to fix.
 *
 * Its own `<form>` so Enter adds, which is what a one-line field is expected to
 * do. The dialog around it is not a form, so this does not nest.
 */
export function DomainInput({
  existing,
  onAdd,
}: {
  existing: readonly string[];
  onAdd: (domains: string[]) => void;
}) {
  const [value, setValue] = useState("");
  const [error, setError] = useState<string | null>(null);
  const isFull = existing.length >= MAX_ALLOWED_DOMAINS;

  const onSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    const { added, rejected } = parseDomainEntries(value, existing);

    if (added.length > 0) onAdd(added);

    // Leave only what was refused in the field, so fixing it is an edit rather
    // than retyping the whole list.
    setValue(rejected.map((item) => item.entry).join(", "));
    setError(
      rejected.length === 0
        ? null
        : rejected.length === 1
          ? rejected[0].reason
          : `Couldn't add ${rejected.length}: ${rejected[0].reason}`,
    );
  };

  return (
    <form onSubmit={onSubmit} noValidate className="flex items-start gap-2">
      <TextField
        fullWidth
        className="min-w-0 flex-1"
        isDisabled={isFull}
        isInvalid={Boolean(error)}
        value={value}
        onChange={(next) => {
          setValue(next);
          if (error) setError(null);
        }}
      >
        <Label>Add a domain</Label>
        <Input autoComplete="off" inputMode="url" spellCheck={false} />
        {error ? (
          <FieldError>{error}</FieldError>
        ) : (
          <Description>
            {isFull
              ? `That's the limit of ${MAX_ALLOWED_DOMAINS}. Remove one to add another.`
              : "A full address works too — only the domain is kept."}
          </Description>
        )}
      </TextField>

      {/* Aligned to the input, not the label above it. */}
      <Button
        type="submit"
        variant="secondary"
        className="mt-6 shrink-0"
        isDisabled={isFull || value.trim() === ""}
      >
        <Plus aria-hidden="true" className="size-4" />
        Add
      </Button>
    </form>
  );
}
