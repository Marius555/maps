"use client";

import { ChevronLeft, ChevronRight } from "lucide-react";
import { useRef, type ReactNode, type RefObject } from "react";

import { IconButton } from "@/components/ui/icon-button";

/**
 * Four things at a time, and a way to reach the rest.
 *
 * A scroll container rather than a slider library: `overflow-x` plus scroll-snap
 * is already a swipeable, keyboard-reachable, screen-reader-legible carousel on
 * every browser we support, and it costs nothing. The arrows drive the same
 * scroll the finger does, so there is one notion of position rather than a
 * JS index that the native scroll can disagree with.
 *
 * The four-up geometry lives in `.carousel-track` (app/globals.css), not here —
 * see the note there for why it is CSS and not utility classes.
 *
 * Rotating wraps at both ends. With a fixed page size and a handful of items,
 * disabled arrows spend most of their life greyed out; wrapping keeps both live
 * and matches what "rotate" promises.
 */

const VISIBLE = 4;

export function useCarousel(): {
  trackRef: RefObject<HTMLUListElement | null>;
  rotate: (direction: 1 | -1) => void;
} {
  const trackRef = useRef<HTMLUListElement>(null);

  const rotate = (direction: 1 | -1) => {
    const track = trackRef.current;
    if (!track) return;

    const end = track.scrollWidth - track.clientWidth;
    if (end <= 0) return;

    // A pixel of slack at each edge: fractional item widths mean `scrollLeft`
    // rarely lands exactly on 0 or `end`, and a strict compare would either
    // never wrap or wrap a page early.
    const isAtEnd = track.scrollLeft >= end - 1;
    const isAtStart = track.scrollLeft <= 1;

    // Clamped rather than wrapped mid-run: a last page holding two items should
    // show those two, not skip past them because a full page would overshoot.
    const left =
      direction === 1
        ? isAtEnd
          ? 0
          : Math.min(track.scrollLeft + track.clientWidth, end)
        : isAtStart
          ? end
          : Math.max(track.scrollLeft - track.clientWidth, 0);

    track.scrollTo({ left });
  };

  return { trackRef, rotate };
}

/**
 * A title, then the arrows and the track on one line.
 *
 * The arrows flank the track rather than sitting in the title row above it: a
 * control belongs beside the thing it moves. Beside, not overlaid — an arrow
 * floating on the edge of the track would cover the first and last item, which
 * on a four-up row is a quarter of what the user came to look at.
 *
 * `variant="ghost"` so they are the chevron and nothing else. A filled pill
 * behind each one gives two small circles the same weight as the pins between
 * them, and the pins are the thing being looked at.
 *
 * The arrow slot is *reserved* when there is nothing to rotate to, not removed.
 * The studio stacks two of these in one dialog, and a track 72px wider than the
 * one below it puts the two rows of pins out of column.
 *
 * `children` are the `<li>`s. A caller that must own the track element itself
 * uses `useCarousel` and puts `.carousel-track` on whatever it renders.
 */
export function Carousel({
  title,
  count,
  action,
  children,
}: {
  title: string;
  /** Items in the track. Below a full page there is nothing to rotate to. */
  count: number;
  /** Goes at the end of the title row — the section's own control, if it has one. */
  action?: ReactNode;
  children: ReactNode;
}) {
  const { trackRef, rotate } = useCarousel();
  const canRotate = count > VISIBLE;

  return (
    <div className="flex flex-col gap-2">
      <div className="flex min-h-8 items-center justify-between gap-2">
        <span className="text-sm font-medium">{title}</span>
        {action}
      </div>

      <div className="flex items-center gap-1">
        {/* `invisible` keeps the width; `isDisabled` keeps it off the tab order,
            so a reserved slot is never a control you can reach but not see. */}
        <span className={canRotate ? undefined : "invisible"}>
          <IconButton
            label={`Previous ${title.toLowerCase()}`}
            icon={ChevronLeft}
            variant="ghost"
            isDisabled={!canRotate}
            onPress={() => rotate(-1)}
          />
        </span>

        <ul ref={trackRef} className="carousel-track">
          {children}
        </ul>

        <span className={canRotate ? undefined : "invisible"}>
          <IconButton
            label={`Next ${title.toLowerCase()}`}
            icon={ChevronRight}
            variant="ghost"
            isDisabled={!canRotate}
            onPress={() => rotate(1)}
          />
        </span>
      </div>
    </div>
  );
}
