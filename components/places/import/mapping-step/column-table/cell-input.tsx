"use client";

/**
 * One cell of the source table, editable in place.
 *
 * A bare `<input>` rather than a HeroUI `TextField`, and that is a measurement
 * rather than a shortcut: fifty rows of fifteen columns is 750 of these on
 * screen at once, and a TextField is a labelled, validated, slot-composed field
 * — none of which a cell has. What a cell needs is a name for a screen reader
 * and a focus ring, which is what this is.
 *
 * Controlled straight from the store with no local copy. The row above is
 * memoised, so a keystroke re-renders one row rather than the whole grid, and
 * skipping the local copy is what keeps a cell corrected from elsewhere — the
 * two halves of a split coordinate column — from showing a stale value.
 */
export function CellInput({
  value,
  label,
  onChange,
}: {
  value: string;
  label: string;
  onChange: (value: string) => void;
}) {
  return (
    <input
      aria-label={label}
      value={value}
      onChange={(event) => onChange(event.target.value)}
      className="w-full min-w-0 rounded-md bg-transparent px-2 py-1.5 text-xs text-foreground outline-none transition-colors hover:bg-default focus-visible:inset-ring-2 focus-visible:inset-ring-focus"
    />
  );
}
