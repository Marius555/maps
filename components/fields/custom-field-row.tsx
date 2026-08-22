"use client";

import { Button, Input, TextField } from "@heroui/react";

import { SelectControl } from "@/components/ui/select-control";
import type { MapField } from "@/lib/repositories/types";
import type { CustomFieldDisplay, CustomFieldType } from "@/lib/validation/field.schema";

/**
 * The two choices are separate because they answer different questions: `type`
 * decides what the value *is* (and so whether it becomes a link), `showAs`
 * decides where it lands on the card. A "menu PDF" is a URL shown as a button; a
 * "dealer code" is text shown as a row; a workshop line is a phone number shown
 * as a row. Folding them into one picker would lose a combination somebody wants.
 */
const TYPE_OPTIONS: { id: CustomFieldType; label: string; description: string }[] = [
  { id: "text", label: "Text", description: "Shown as it is written." },
  { id: "url", label: "Link", description: "Opens in a new tab." },
  { id: "tel", label: "Phone", description: "Tap to call on a phone." },
  { id: "email", label: "Email", description: "Opens the visitor's mail app." },
];

const DISPLAY_OPTIONS: { id: CustomFieldDisplay; label: string; description: string }[] =
  [
    { id: "row", label: "Detail row", description: "A labelled line on the card." },
    { id: "button", label: "Button", description: "A call to action, next to Directions." },
  ];

export function CustomFieldRow({
  field,
  usageCount,
  onChange,
  onRemove,
}: {
  field: MapField;
  /** How many locations have filled it in, so removal isn't a blind decision. */
  usageCount: number;
  onChange: (field: MapField) => void;
  onRemove: () => void;
}) {
  const named = field.label || "this field";

  return (
    <li className="flex flex-col gap-3 rounded-xl border border-border p-3 sm:flex-row sm:items-end">
      <TextField
        fullWidth
        aria-label={`Name for ${named}`}
        value={field.label}
        onChange={(label) => onChange({ ...field, label })}
        className="sm:flex-1"
      >
        <Input placeholder="Field name, e.g. Book a fitting" />
      </TextField>

      <div className="flex gap-3 sm:w-96">
        <SelectControl
          label="Type"
          options={TYPE_OPTIONS}
          value={field.type}
          onChange={(value) => onChange({ ...field, type: value as CustomFieldType })}
        />
        <SelectControl
          label="Show as"
          options={DISPLAY_OPTIONS}
          value={field.showAs}
          onChange={(value) =>
            onChange({ ...field, showAs: value as CustomFieldDisplay })
          }
        />
      </div>

      <div className="flex items-center justify-between gap-2 sm:justify-end">
        {usageCount > 0 ? (
          <span className="text-xs tabular-nums text-muted">
            {usageCount === 1 ? "1 location" : `${usageCount} locations`}
          </span>
        ) : null}

        <Button
          size="sm"
          variant="tertiary"
          aria-label={`Remove ${named}`}
          onPress={onRemove}
        >
          Remove
        </Button>
      </div>
    </li>
  );
}
