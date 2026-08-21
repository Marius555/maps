"use client";

import { ChevronLeft, ChevronRight } from "lucide-react";
import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";

import { IconButton } from "@/components/ui/icon-button";

/**
 * A row of things and a way to reach the ones that don't fit.
 *
 * A scroll container rather than a slider library: `overflow-x` plus scroll-snap
 * is already a swipeable, keyboard-reachable, screen-reader-legible carousel on
 * every browser we support, and it costs nothing. The arrows drive the same
 * scroll the finger does, so there is one notion of position rather than a
 * JS index that the native scroll can disagree with.
 *
 * The track geometry lives in `.carousel-track` (app/globals.css), not here —
 * see the note there for why it is CSS and not utility classes. Two widths are
 * offered: pages of four, and pages of three for the narrower dialogs. Both
 * scroll the same way, which is why they share these arrows.
 *
 * Rotating wraps at both ends. With a handful of items, disabled arrows spend
 * most of their life greyed out; wrapping keeps both live and matches what
 * "rotate" promises.
 */

/**
 * The track itself, flanked by its arrows.
 *
 * The arrows flank the track rather than sitting in a row above it: a control
 * belongs beside the thing it moves. Beside, not overlaid — an arrow floating on
 * the edge of the track would cover the first and last item, which on a four-up
 * row is a quarter of what the user came to look at.
 *
 * `variant="ghost"` so they are the chevron and nothing else. A filled pill
 * behind each one gives two small circles the same weight as the pins between
 * them, and the pins are the thing being looked at.
 *
 * The arrow slot is *reserved* when there is nothing to rotate to, not removed.
 * Several of these stack inside one dialog, and a track 72px wider than the one
 * below it puts two rows out of column — and a row that reflows the moment a
 * resize makes it overflow is worse again.
 */
export function CarouselTrack({
  label,
  count,
  columns = 4,
  as = "ul",
  children,
}: {
  /** Names the arrows. The visible label belongs to whatever wraps this. */
  label: string;
  /** Items in the track. Only used to re-measure when the count changes. */
  count: number;
  /** Items visible at once. Three where a tile has to be big enough to read. */
  columns?: 3 | 4;
  /** `div` where list semantics would be a lie — a group of controls, say. */
  as?: "ul" | "div";
  children: ReactNode;
}) {
  const track = useRef<HTMLElement | null>(null);
  const canRotate = useOverflow(track, count);

  // A callback ref rather than the object kind, so one ref serves both tags
  // below without a cast: `(node: HTMLElement | null) => void` is assignable to
  // both `Ref<HTMLUListElement>` and `Ref<HTMLDivElement>`.
  const setTrack = useCallback((node: HTMLElement | null) => {
    track.current = node;
  }, []);

  const rotate = (direction: 1 | -1) => {
    const element = track.current;
    if (!element) return;

    const end = element.scrollWidth - element.clientWidth;
    if (end <= 0) return;

    // A pixel of slack at each edge: fractional item widths mean `scrollLeft`
    // rarely lands exactly on 0 or `end`, and a strict compare would either
    // never wrap or wrap a page early.
    const isAtEnd = element.scrollLeft >= end - 1;
    const isAtStart = element.scrollLeft <= 1;

    // Clamped rather than wrapped mid-run: a last page holding two items should
    // show those two, not skip past them because a full page would overshoot.
    const left =
      direction === 1
        ? isAtEnd
          ? 0
          : Math.min(element.scrollLeft + element.clientWidth, end)
        : isAtStart
          ? end
          : Math.max(element.scrollLeft - element.clientWidth, 0);

    element.scrollTo({ left });
  };

  const className = `carousel-track${columns === 3 ? " carousel-track--three" : ""}`;

  return (
    <div className="flex items-center gap-1">
      {/* `invisible` keeps the width; `isDisabled` keeps it off the tab order,
          so a reserved slot is never a control you can reach but not see. */}
      <span className={canRotate ? undefined : "invisible"}>
        <IconButton
          label={`Previous ${label.toLowerCase()}`}
          icon={ChevronLeft}
          variant="ghost"
          isDisabled={!canRotate}
          onPress={() => rotate(-1)}
        />
      </span>

      {as === "div" ? (
        <div ref={setTrack} className={className}>
          {children}
        </div>
      ) : (
        <ul ref={setTrack} className={className}>
          {children}
        </ul>
      )}

      <span className={canRotate ? undefined : "invisible"}>
        <IconButton
          label={`Next ${label.toLowerCase()}`}
          icon={ChevronRight}
          variant="ghost"
          isDisabled={!canRotate}
          onPress={() => rotate(1)}
        />
      </span>
    </div>
  );
}

/**
 * Whether the track actually overflows, watched.
 *
 * Measured rather than counted, which is the only rule that works for both track
 * widths without this having to know which one it is holding. Counting was also
 * quietly wrong for the four-up track it was written for: four tiles overflow a
 * narrow drawer too, and got no arrows.
 *
 * A `ResizeObserver` on the track catches the container changing width. Content
 * changing is caught by re-running on `count`, which is why that is a prop
 * rather than something derived from `children` — `children` is a fresh object
 * every render and would re-subscribe the observer on each one.
 */
function useOverflow(track: { current: HTMLElement | null }, count: number): boolean {
  const [hasOverflow, setHasOverflow] = useState(false);

  useEffect(() => {
    const element = track.current;
    if (!element) return;

    // The same pixel of slack `rotate` allows, and for the same reason.
    const measure = () => setHasOverflow(element.scrollWidth - element.clientWidth > 1);

    measure();

    const observer = new ResizeObserver(measure);
    observer.observe(element);

    return () => observer.disconnect();
  }, [track, count]);

  return hasOverflow;
}

/**
 * A title, then the arrows and the track on one line.
 *
 * `children` are the `<li>`s. A caller that needs a different label treatment —
 * a form row's own, say — uses `CarouselTrack` directly and supplies its own.
 */
export function Carousel({
  title,
  count,
  action,
  children,
}: {
  title: string;
  /** Items in the track. */
  count: number;
  /** Goes at the end of the title row — the section's own control, if it has one. */
  action?: ReactNode;
  children: ReactNode;
}) {
  return (
    <div className="flex flex-col gap-2">
      <div className="flex min-h-8 items-center justify-between gap-2">
        <span className="text-sm font-medium">{title}</span>
        {action}
      </div>

      <CarouselTrack label={title} count={count}>
        {children}
      </CarouselTrack>
    </div>
  );
}
