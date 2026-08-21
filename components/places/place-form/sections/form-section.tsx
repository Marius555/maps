"use client";

import { ChevronRight } from "lucide-react";
import { useState } from "react";

/**
 * A part of the form you can put away.
 *
 * The edit dialog was eleven controls in one flat stack — name, address,
 * category, pin, photo, description, phone, email, website and seven rows of
 * opening hours — with nothing saying which of them mattered, which were
 * optional, or which this location had already been given. Opening it to fix a
 * typo meant reading all of it to find the one field.
 *
 * So the four or five things every location needs stay open, and the rest fold
 * away behind a line each. The summary on the right is what makes that safe:
 * folding a field out of sight only works if the fold itself says whether there
 * is anything in there, otherwise the form has simply hidden the work.
 *
 * A native `<details>` because it is one, and because the disclosure then works
 * from the keyboard with no code. `open` is forced when the section holds a
 * validation error — a message nobody can see is the same as no message, and a
 * form that refuses to save without saying why is the worst version of this.
 */
export function FormSection({
  title,
  summary,
  hasError,
  children,
}: {
  title: string;
  /** What is inside, without opening it — "2 of 3", "Not set". */
  summary: string;
  hasError?: boolean;
  children: React.ReactNode;
}) {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <details
      open={isOpen || Boolean(hasError)}
      onToggle={(event) => setIsOpen(event.currentTarget.open)}
      className="group rounded-lg border border-border"
    >
      <summary className="flex cursor-pointer list-none items-center justify-between gap-3 rounded-lg px-3 py-2.5 outline-none transition-colors hover:bg-default focus-visible:inset-ring-2 focus-visible:inset-ring-focus [&::-webkit-details-marker]:hidden">
        <span className="flex min-w-0 items-center gap-2">
          <ChevronRight
            aria-hidden="true"
            className="size-4 shrink-0 text-muted transition-transform group-open:rotate-90"
          />
          <span className="truncate text-sm font-medium text-foreground">
            {title}
          </span>
        </span>

        <span
          className={`shrink-0 text-xs ${hasError ? "text-danger" : "text-muted"}`}
        >
          {summary}
        </span>
      </summary>

      <div className="space-y-4 border-t border-border px-3 py-3">{children}</div>
    </details>
  );
}

/** "2 of 3" once anything is filled in, and a plain word before that. */
export function filledSummary(values: (string | null | undefined)[]): string {
  const filled = values.filter((value) => Boolean(value && value.trim())).length;

  if (filled === 0) return "Not set";
  return `${filled} of ${values.length}`;
}
