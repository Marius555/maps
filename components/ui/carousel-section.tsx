"use client";

import { Chip, Surface } from "@heroui/react";
import type { ReactNode } from "react";

import { CarouselTrack } from "./carousel";

/**
 * A named set of tiles on a panel of its own: title, a one-line hint, a count,
 * then the one-line carousel.
 *
 * Shared by the pin library and the cluster icon picker so the two dialogs that
 * lay out the same pins look like the same product. A bare label over a bare
 * track was what both had before, and two of those stacked read as one long
 * undivided list.
 *
 * HeroUI's `Surface` rather than a hand-rolled grey box, so the panel follows the
 * theme's own surface tokens in light and dark.
 *
 * `children` are the `<li>`s. `empty`, when given, replaces the track — an
 * invitation to act rather than a row of reserved arrow slots around nothing.
 */
export function CarouselSection({
  title,
  hint,
  count,
  badge,
  empty,
  footnote,
  children,
}: {
  title: string;
  /** What pressing a tile here does, in a few words. */
  hint?: string;
  /** Items in the track. */
  count: number;
  /** The chip's text. Omitted, the chip shows `count`; `null` hides it. */
  badge?: string | null;
  /** Shown instead of the track when there is nothing in it. */
  empty?: ReactNode;
  /** A line under the track — the reason tiles are off, say. */
  footnote?: ReactNode;
  children?: ReactNode;
}) {
  const isEmpty = count === 0 && empty !== undefined;

  return (
    <Surface variant="secondary" className="flex flex-col gap-3 rounded-2xl p-3">
      <div className="flex items-start justify-between gap-3 px-1">
        <div className="flex min-w-0 flex-col">
          <span className="text-sm font-medium">{title}</span>
          {hint ? <span className="text-xs text-muted">{hint}</span> : null}
        </div>

        {isEmpty || badge === null ? null : (
          <Chip size="sm" variant="soft" className="shrink-0">
            <Chip.Label>{badge ?? count}</Chip.Label>
          </Chip>
        )}
      </div>

      {isEmpty ? (
        empty
      ) : (
        <CarouselTrack label={title} count={count}>
          {children}
        </CarouselTrack>
      )}

      {footnote ? <div className="px-1 text-xs text-muted">{footnote}</div> : null}
    </Surface>
  );
}
