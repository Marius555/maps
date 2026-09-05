"use client";

import { SelectControl } from "@/components/ui/select-control";
import { nearestStop } from "@/lib/card/scale-stops";

/**
 * A number with more named steps than a row of tiles can hold.
 *
 * `PropertyScale` is the default and stays it: a handful of choices are all
 * worth seeing at once, and picking one is a single press. But five *words* in a
 * 20rem column is about 60px a tile — "Regular" arrives as "Reg…", and a control
 * nobody can read is worse than one that costs a second press. That is the
 * complaint this answers, and it answers it only where the words are load-
 * bearing: a tile drawing its own corner radius says itself at any width and
 * stays a tile.
 *
 * **The displayed step is snapped and nothing is written to snap it** — the same
 * contract `PropertyScale` documents. A stored number between two stops lights
 * the nearer one; only a press writes.
 */
export function PropertyNumberSelect({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: number;
  options: readonly { value: number; label: string; description?: string }[];
  onChange: (value: number) => void;
}) {
  const stops = options.map((option) => option.value);

  return (
    <SelectControl
      // `secondary`, because this sits on a raised surface where the default
      // variant's ground is the same colour as the panel — the trap
      // `SelectControl`'s own docblock spells out.
      variant="secondary"
      label={label}
      value={String(nearestStop(value, stops))}
      options={options.map((option) => ({
        id: String(option.value),
        label: option.label,
        description: option.description,
      }))}
      onChange={(next) => onChange(Number(next))}
    />
  );
}
