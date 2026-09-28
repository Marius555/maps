"use client";

import { ToggleButton, ToggleButtonGroup } from "@heroui/react";
import { useId } from "react";

/**
 * What a message is about, as a row of buttons rather than a select: four
 * choices fit on screen at once, so a closed dropdown would only hide them.
 *
 * Detached buttons in a grid — two by two on a phone, one row from `sm` — so no
 * label is squeezed onto two lines. One is always chosen; the form starts on the
 * first, so there is never a message filed under nothing.
 */
export function KindOptions<Id extends string>({
  label,
  options,
  value,
  onChange,
}: {
  label: string;
  options: readonly { id: Id; label: string }[];
  value: Id;
  onChange: (next: Id) => void;
}) {
  const labelId = useId();

  return (
    <div className="space-y-2">
      <p id={labelId} className="text-sm font-medium text-foreground">
        {label}
      </p>
      <ToggleButtonGroup
        aria-labelledby={labelId}
        selectionMode="single"
        disallowEmptySelection
        isDetached
        fullWidth
        selectedKeys={[value]}
        onSelectionChange={(keys) => {
          const next = options.find((option) => keys.has(option.id));
          if (next) onChange(next.id);
        }}
        className="grid grid-cols-2 gap-2 sm:grid-cols-4"
      >
        {options.map((option) => (
          <ToggleButton key={option.id} id={option.id} size="sm" className="w-full">
            {option.label}
          </ToggleButton>
        ))}
      </ToggleButtonGroup>
    </div>
  );
}
