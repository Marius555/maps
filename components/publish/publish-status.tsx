"use client";

import { formatDistanceToNow } from "date-fns";

import type { AppMap } from "@/lib/repositories/types";

/**
 * Where the map stands: never published, live and current, or live but behind
 * what's in the editor.
 *
 * **`compact` is the same three states in a strip rather than a sentence**, for
 * the sheet's peek row below `lg` (`DesignSidebar`). That row is 2.75rem tall on
 * a 390px screen and holds the panel's name as well, and the full form is a line
 * of prose that wrapped onto three of them and printed itself over "Design". The
 * word plus a dot is what survives the trim: whether it is live at all, and
 * whether what is live is current. The sentence explaining what publishing *does*
 * is for the footer, where somebody is about to press the button.
 */
export function PublishStatus({
  map,
  hasPendingChanges,
  compact = false,
  storefront = false,
}: {
  map: AppMap;
  hasPendingChanges: boolean;
  compact?: boolean;
  /** Inside the Shopify admin: one line with a dot, because the footer there
      also holds the storefront row and every line is taken from the design
      folds. The sentence about a snippet is not true there anyway — the way
      onto the store is Show on storefront, whose toast says it published. */
  storefront?: boolean;
}) {
  if (compact) {
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

  if (storefront) {
    const dot = !map.publishedAt
      ? "border border-muted"
      : hasPendingChanges
        ? "bg-accent"
        : "bg-success";

    return (
      <p className="flex min-w-0 items-center gap-1.5 text-xs text-muted">
        <span aria-hidden="true" className={`size-2 shrink-0 rounded-full ${dot}`} />
        <span className="truncate">
          {!map.publishedAt ? (
            "Not published"
          ) : (
            <>
              <span className="text-foreground">Live</span>
              {" · "}
              {hasPendingChanges ? (
                <span className="text-accent">changes not published</span>
              ) : (
                formatDistanceToNow(new Date(map.publishedAt), { addSuffix: true })
              )}
            </>
          )}
        </span>
      </p>
    );
  }

  if (!map.publishedAt) {
    return (
      <p className="text-xs text-muted">
        Not published yet. Publishing generates the map your visitors see and
        gives you a snippet to paste into your site.
      </p>
    );
  }

  return (
    <p className="text-xs text-muted">
      <span className="text-foreground">Live</span> · published{" "}
      {formatDistanceToNow(new Date(map.publishedAt), { addSuffix: true })}
      {hasPendingChanges ? (
        <>
          {" · "}
          <span className="text-accent">
            you&rsquo;ve made changes since — publish again to push them
          </span>
        </>
      ) : null}
    </p>
  );
}
