"use client";

/**
 * A bare `<input type="time">`, styled to sit beside HeroUI's inputs.
 *
 * Not HeroUI's `TimeField`. That is React Aria's segmented field, and its value
 * is an `@internationalized/date` `Time` object — a package we would be importing
 * without declaring it (§3 says ask before adding one), plus a conversion in both
 * directions on every keystroke. Opening hours are stored as "HH:MM" strings, and
 * a native time input *is* that string: `value` in, `value` out, no adapter and
 * nothing to get wrong.
 *
 * The browser still renders it in the user's own locale, so a US visitor sees a
 * 12-hour picker over the same 24-hour value.
 */
export function TimeInput({
  value,
  label,
  isDisabled,
  onChange,
}: {
  value: string;
  /** Visually hidden — a seven-row grid cannot carry fourteen visible labels. */
  label: string;
  isDisabled?: boolean;
  onChange: (value: string) => void;
}) {
  return (
    <input
      type="time"
      aria-label={label}
      value={value}
      disabled={isDisabled}
      onChange={(event) => onChange(event.target.value)}
      className="h-9 w-full rounded-lg border border-border bg-surface px-2 text-sm tabular-nums text-foreground outline-none focus-visible:inset-ring-2 focus-visible:inset-ring-focus disabled:opacity-50"
    />
  );
}
