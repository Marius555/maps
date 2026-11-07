"use client";

import type { LucideIcon } from "lucide-react";
import type { MouseEvent } from "react";

import type { AppMap } from "@/lib/repositories/types";
import { PublishStatus } from "../publish-status";

/**
 * A stepper's heading row: where the map goes ("Your store", "Your website")
 * on the left, and whether it is live, and since when, on the right — in every
 * state, loading and failed included.
 *
 * **While a designer fold is open the steps fold away and this row is all that
 * is left** (`HeightCollapse`, the owner's request of 2026-11-07). Then the
 * whole row is a button that brings them back — `onExpand`, which closes the
 * open fold, so the two move together the other way. Without it, Publish would
 * be hidden behind whichever fold happened to be open.
 *
 * The button sits *under* the row's text rather than around it, the
 * stretched-link pattern: a heading and a status paragraph cannot go inside a
 * `<button>`, and the text takes no pointer events so a press anywhere on the
 * row lands on it. Once pressed, focus moves into the steps it opened, because
 * the button it was on is gone.
 */
export function StepperHeading({
  id,
  icon: Icon,
  title,
  map,
  hasPendingChanges,
  onExpand,
}: {
  /** For the section's `aria-labelledby`. */
  id: string;
  icon: LucideIcon;
  title: string;
  map: AppMap;
  hasPendingChanges: boolean;
  /** Given only while the steps are folded away. */
  onExpand?: () => void;
}) {
  const expand = (event: MouseEvent<HTMLButtonElement>) => {
    const section = event.currentTarget.closest("section");
    onExpand?.();
    // After React has committed the open state, which takes `inert` off.
    requestAnimationFrame(() => {
      section
        ?.querySelector<HTMLElement>(
          "[data-height-collapse] button:not([disabled]), [data-height-collapse] a[href]",
        )
        ?.focus({ preventScroll: true });
    });
  };

  return (
    <div className="relative flex min-w-0 items-center justify-between gap-3">
      {onExpand ? (
        <button
          type="button"
          aria-expanded={false}
          aria-label={`${title}: show the steps`}
          onClick={expand}
          className="absolute -inset-x-1.5 -inset-y-1 cursor-pointer rounded-lg outline-none transition-colors hover:bg-default focus-visible:ring-2 focus-visible:ring-focus"
        />
      ) : null}

      <h3
        id={id}
        className="pointer-events-none relative flex shrink-0 items-center gap-1.5 text-xs font-medium tracking-wide text-muted uppercase"
      >
        <Icon aria-hidden="true" className="size-3.5" />
        {title}
      </h3>

      {/* No chevron beside it, on purpose: the owner asked for the title and
          the status and nothing else in this row, and in a 20rem column a
          chevron's 20px is what truncated "Live · changes not published".
          The hover fill and the pointer say it can be pressed. */}
      <div className="pointer-events-none relative flex min-w-0 items-center">
        <PublishStatus map={map} hasPendingChanges={hasPendingChanges} form="heading" />
      </div>
    </div>
  );
}
