"use client";

import { Button, Input, Label, TextField } from "@heroui/react";
import { Trash2 } from "lucide-react";

import { PropertyChoice } from "@/components/ui/properties/property-fields";
import type { MapField } from "@/lib/repositories/types";
import type { CustomFieldDisplay, CustomFieldType } from "@/lib/validation/field.schema";

/**
 * The two choices are separate because they answer different questions: `type`
 * decides what the value *is* (and so whether it becomes a link), `showAs`
 * decides where it lands on the card. A "menu PDF" is a URL shown as a button; a
 * "dealer code" is text shown as a row; a workshop line is a phone number shown
 * as a row. Folding them into one picker would lose a combination somebody wants.
 *
 * Segmented rows rather than selects: four and two options are all worth seeing
 * at once, and the selects beside a name field squeezed the name to a few
 * letters and printed each option's description inside the trigger.
 */
const TYPE_OPTIONS = [
  { value: "text", label: "Text" },
  { value: "url", label: "Link" },
  { value: "tel", label: "Phone" },
  { value: "email", label: "Email" },
] as const satisfies readonly { value: CustomFieldType; label: string }[];

const DISPLAY_OPTIONS = [
  { value: "row", label: "Detail row" },
  { value: "button", label: "Button" },
] as const satisfies readonly { value: CustomFieldDisplay; label: string }[];

export function CustomFieldRow({
  field,
  autoFocus,
  usageCount,
  onChange,
  onRemove,
}: {
  field: MapField;
  /** Focus the name on mount — the row was just added. */
  autoFocus?: boolean;
  /** How many locations have filled it in, so removal isn't a blind decision. */
  usageCount: number;
  onChange: (field: MapField) => void;
  onRemove: () => void;
}) {
  const named = field.label || "this field";

  return (
    <li className="space-y-3 rounded-xl bg-surface-secondary p-3 sm:p-4">
      <div className="flex items-end gap-2">
        <TextField
          fullWidth
          autoFocus={autoFocus}
          value={field.label}
          onChange={(label) => onChange({ ...field, label })}
          className="min-w-0 flex-1"
        >
          <Label>Field name</Label>
          <Input placeholder="e.g. Dealer code, Book a fitting" />
        </TextField>

        <Button
          size="sm"
          variant="ghost"
          isIconOnly
          aria-label={`Remove ${named}`}
          onPress={onRemove}
        >
          <Trash2 aria-hidden="true" className="size-4" />
        </Button>
      </div>

      {/* The toggle group is transparent with a grey selected fill, which on
          this grey block would leave the chosen option unmarked — so its
          ground is the dialog's own white here. */}
      <div className="grid gap-3 sm:grid-cols-[3fr_2fr] [&_.quiet-toggles]:bg-surface">
        <PropertyChoice<CustomFieldType>
          label="Type"
          value={field.type}
          options={TYPE_OPTIONS}
          onChange={(type) => onChange({ ...field, type })}
        />
        <PropertyChoice<CustomFieldDisplay>
          label="Show on the card as"
          value={field.showAs}
          options={DISPLAY_OPTIONS}
          onChange={(showAs) => onChange({ ...field, showAs })}
        />
      </div>

      {usageCount > 0 ? (
        <p className="text-xs tabular-nums text-muted">
          Filled in on {usageCount === 1 ? "1 location" : `${usageCount} locations`}
        </p>
      ) : null}
    </li>
  );
}
