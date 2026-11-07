"use client";

import { AnimatePresence, motion } from "motion/react";

import { publishedAgo } from "@/lib/format/ago";
import type { AppMap } from "@/lib/repositories/types";

/**
 * Where the map stands: never published, live and current, or live but behind
 * what's in the editor. Two `form`s, one per place it is drawn:
 *
 * - **`heading`** — one line with a dot, on the right of the Publish footer's
 *   stepper heading ("Your store" / "Your website", `StepperHeading`), the
 *   time in numbers ("1 h ago", `ShortAgo`). What publishing *does* is said by
 *   the steps under it, so this says only whether it is live and since when.
 * - **`compact`** — the same three states in a strip, for the sheet's peek row
 *   below `lg` (`DesignSidebar`). That row is 2.75rem tall on a 390px screen
 *   and holds the panel's name as well; the word plus a dot is what survives:
 *   whether it is live at all, and whether what is live is current.
 *
 * The sentence form that used to sit above Publish outside Shopify ("Live ·
 * published 3 minutes ago · you've made changes since…") went with the
 * "Your website" stepper (2026-11-07).
 */
export function PublishStatus({
  map,
  hasPendingChanges,
  form,
}: {
  map: AppMap;
  hasPendingChanges: boolean;
  form: "heading" | "compact";
}) {
  if (form === "compact") {
    return (
      <p className="flex shrink-0 items-center gap-1.5 text-xs whitespace-nowrap text-muted">
        {map.publishedAt ? (
          <span className="text-foreground">Live</span>
        ) : (
          "Not published"
        )}

        {/* The card designer's unsaved dot, said about a publish instead — and
            `bg-accent` for its reason too: work that has not gone out yet is the
            normal state of a designer, not a fault. `sr-only` beside it, because
            a 8px circle says nothing to a screen reader. */}
        {hasPendingChanges ? (
          <>
            <span
              aria-hidden="true"
              className="size-2 shrink-0 rounded-full bg-accent"
            />
            <span className="sr-only">(unpublished changes)</span>
          </>
        ) : null}
      </p>
    );
  }

  const state = !map.publishedAt ? "unpublished" : hasPendingChanges ? "behind" : "current";
  // A border on every state, so only colour changes and the dot can fade.
  const dot = {
    unpublished: "border-muted bg-transparent",
    behind: "border-accent bg-accent",
    current: "border-success bg-success",
  }[state];

  return (
    <p className="flex min-w-0 items-center gap-1.5 text-xs text-muted">
      <span
        aria-hidden="true"
        className={`size-2 shrink-0 rounded-full border transition-colors duration-200 ${dot}`}
      />
      {/* Cross-faded rather than swapped: it changes the moment a redeploy
          lands, beside a stepper that is easing to its new state. */}
      <AnimatePresence initial={false} mode="wait">
        <motion.span
          key={state}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.15 }}
          className="truncate"
        >
          {!map.publishedAt ? (
            "Not published"
          ) : (
            <>
              <span className="text-foreground">Live</span>
              {" · "}
              {state === "behind" ? (
                <span className="text-accent">changes not published</span>
              ) : (
                <ShortAgo at={map.publishedAt} />
              )}
            </>
          )}
        </motion.span>
      </AnimatePresence>
    </p>
  );
}

/**
 * "12 min ago", "1 h ago", "2 weeks ago" — worked out once, no counter (the
 * owner's call). In its own element with `suppressHydrationWarning` because it
 * is the one text *meant* to differ between the server's render and the
 * browser's: rendered at request time and hydrated later — inside the Shopify
 * admin's iframe, sometimes a minute later — two different strings failed
 * hydration and regenerated the whole sidebar.
 */
function ShortAgo({ at }: { at: string }) {
  return <span suppressHydrationWarning>{publishedAgo(at)}</span>;
}
