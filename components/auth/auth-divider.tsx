import { Separator } from "@heroui/react";

/**
 * "or", with a rule either side.
 *
 * Two separators rather than one line with a background-coloured label over it:
 * the label trick needs the strip behind it to match the page, and this page's
 * background is a theme variable that crossfades — a hardcoded match would go
 * wrong for the length of every theme change. Two elements have nothing to match.
 *
 * `aria-hidden` on the word: it is punctuation between two ways of doing the same
 * thing, and read aloud between a button and a form it sounds like an option.
 */
export function AuthDivider() {
  return (
    <div className="flex items-center gap-3">
      <Separator className="flex-1" />
      <span aria-hidden="true" className="text-xs text-muted">
        or
      </span>
      <Separator className="flex-1" />
    </div>
  );
}
