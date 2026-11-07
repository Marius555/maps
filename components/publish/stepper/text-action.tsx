"use client";

import type { LucideIcon } from "lucide-react";
import type { ReactNode } from "react";

const TONES = {
  default: "text-muted hover:text-foreground",
  danger: "text-muted hover:text-danger",
  accent: "font-medium text-accent",
} as const;

/**
 * A secondary move in the Publish footer's steppers, drawn as words rather
 * than as a button — Remove, Make default, Already added, Try again.
 *
 * The stepper's rule is that one button is filled and the eye goes there. The
 * moves that are not "the next step" are still one press away, but they must
 * not look like candidates for it: four buttons of similar weight was the
 * layout the owner could not read (docs/notes/shopify.md).
 *
 * `tone="accent"` is the link at the foot of the status step — Open theme
 * editor, Get embed code — which the owner asked for as text, not as the large
 * button it was (2026-11-07). `icon` trails the words.
 */
export function TextAction({
  onPress,
  isDisabled = false,
  tone = "default",
  icon: Icon,
  children,
}: {
  onPress: () => void;
  isDisabled?: boolean;
  tone?: keyof typeof TONES;
  icon?: LucideIcon;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      disabled={isDisabled}
      onClick={onPress}
      className={`inline-flex shrink-0 items-center gap-1 rounded text-xs underline-offset-2 outline-none hover:underline focus-visible:ring-2 focus-visible:ring-focus disabled:cursor-default disabled:opacity-50 disabled:hover:no-underline ${TONES[tone]}`}
    >
      {children}
      {Icon ? <Icon aria-hidden="true" className="size-3.5" /> : null}
    </button>
  );
}
