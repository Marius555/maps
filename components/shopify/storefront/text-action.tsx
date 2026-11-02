"use client";

import type { ReactNode } from "react";

/**
 * A secondary move in the storefront stepper, drawn as words rather than as a
 * button — Remove, Make default, Already added, Open editor.
 *
 * The stepper's rule is that one button is filled and the eye goes there. The
 * moves that are not "the next step" are still one press away, but they must
 * not look like candidates for it: four buttons of similar weight was the
 * layout the owner could not read (docs/notes/shopify.md).
 */
export function TextAction({
  onPress,
  isDisabled = false,
  tone = "default",
  children,
}: {
  onPress: () => void;
  isDisabled?: boolean;
  tone?: "default" | "danger";
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      disabled={isDisabled}
      onClick={onPress}
      className={`shrink-0 rounded text-xs underline-offset-2 outline-none hover:underline focus-visible:ring-2 focus-visible:ring-focus disabled:cursor-default disabled:opacity-50 disabled:hover:no-underline ${
        tone === "danger" ? "text-muted hover:text-danger" : "text-muted hover:text-foreground"
      }`}
    >
      {children}
    </button>
  );
}
