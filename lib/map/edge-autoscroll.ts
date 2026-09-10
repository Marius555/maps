/**
 * Scrolling a container by holding a drag near its edge.
 *
 * This exists because the Locations panel now has a real height and therefore
 * genuinely scrolls. Before that it grew to fit and everything was always on
 * screen; now a group can be scrolled out of view, and `use-row-drag.ts` calls
 * `preventDefault()` on every `pointermove` precisely so the gesture does not
 * scroll — which together would make "drag this location into that group" an
 * impossible request whenever the two are more than a panel apart. Nothing else
 * in the app moves the panel during a drag, so a drop target off screen is
 * simply unreachable without this.
 *
 * Plain DOM and a `requestAnimationFrame` loop, no React, for the same reason
 * `row-drag-ghost.ts` is: this runs at pointer rate for the length of a gesture,
 * and re-rendering a panel of up to 3,000 rows to move it by six pixels is not a
 * trade worth making.
 *
 * In `lib/map/` rather than beside the hook, for the reason `drop-action.ts` and
 * `marquee.ts` are: it is the part of the gesture that is decidable without a
 * pointer, so it is the part worth testing.
 */

/** How deep into the container the pull starts. About two rows' worth. */
const BAND = 56;

/** Pixels per frame at the very edge. ~14px/frame is a brisk but followable pull. */
const MAX_SPEED = 14;

export type EdgeAutoScroll = {
  /**
   * Latest pointer position, in viewport coordinates.
   *
   * `clientX` is optional because the vertical band is the whole of the
   * behaviour and every existing caller only had a y — but a pull that ignores
   * x is a real bug rather than a simplification. See `update` below.
   */
  update: (clientY: number, clientX?: number) => void;
  stop: () => void;
};

/**
 * The nearest ancestor that can actually scroll, if any.
 *
 * Walks up from the dragged row rather than being handed a ref, because the row
 * components are shared with the Locations *tab*, where there is no panel and no
 * scroller — so the answer has to be "none" without either caller knowing which
 * case it is in. `scrollHeight > clientHeight` is checked as well as the computed
 * overflow: an `auto` container with nothing to scroll would otherwise capture
 * the drag and then do nothing with it.
 *
 * **`slack` is that last check, and `lib/ui/reveal-fold.ts` is the one caller that
 * needs it.** A drag needs a container overflowing *now*, because there is nowhere
 * to pull to otherwise, and that is the default. A fold's reveal asks one frame
 * before the panel grows, so the container it has to move is routinely not
 * overflowing yet and will be by the time the answer is used — `slack` is how much
 * taller the content is about to get. It is not a boolean because the distinction
 * that matters is not "ignore the check" but "check against the height the content
 * is going to have".
 *
 * It is not a complete answer and does not pretend to be. HeroUI's `ScrollShadow`
 * is `overflow-y: auto` unconditionally, so below `lg` the card designer has one
 * whose own height follows its content — it can never scroll, and no measurement
 * taken before the growth can say so, because its `clientHeight` is about to grow
 * by the same amount as its `scrollHeight`. `revealFold` covers that case at the
 * other end instead, with one corrective `scrollIntoView` when the animation
 * settles.
 */
export function scrollableAncestor(
  from: HTMLElement,
  { slack = 0 }: { slack?: number } = {},
): HTMLElement | null {
  let element: HTMLElement | null = from.parentElement;

  while (element) {
    const { overflowY } = getComputedStyle(element);

    if (
      (overflowY === "auto" || overflowY === "scroll") &&
      element.scrollHeight + slack > element.clientHeight
    ) {
      return element;
    }

    element = element.parentElement;
  }

  return null;
}

export function startEdgeAutoScroll(container: HTMLElement): EdgeAutoScroll {
  let velocity = 0;
  let frame: number | null = null;

  const step = () => {
    frame = null;
    if (velocity === 0) return;

    const before = container.scrollTop;
    container.scrollTop = before + velocity;

    // Stop at the ends rather than spinning a frame loop forever against a
    // scrollTop that cannot move.
    if (container.scrollTop === before) {
      velocity = 0;
      return;
    }

    frame = requestAnimationFrame(step);
  };

  const run = () => {
    if (frame === null && velocity !== 0) frame = requestAnimationFrame(step);
  };

  return {
    update: (clientY, clientX) => {
      const rect = container.getBoundingClientRect();

      /*
       * A pointer that is not over this container is not near its edge.
       *
       * Without this the band is an infinite horizontal strip: the card
       * designer's palette drags *out* of the panel and across the card, and
       * anything held above `rect.top + BAND` — most of the upper half of the
       * window — read as "at the top edge" and pulled the panel out from under
       * the drag. The Locations list has the same shape of bug against the map
       * beside it.
       *
       * Undefined means "not told", which stays the old behaviour rather than
       * silently freezing a caller that has not been updated.
       */
      if (clientX !== undefined && (clientX < rect.left || clientX > rect.right)) {
        velocity = 0;
        return;
      }

      // Proportional to how far into the band the pointer is, so easing towards
      // the edge eases the scroll — a fixed speed makes the list feel like it is
      // being yanked the moment you cross an invisible line.
      const above = rect.top + BAND - clientY;
      const below = clientY - (rect.bottom - BAND);

      if (above > 0) {
        velocity = -MAX_SPEED * Math.min(above / BAND, 1);
      } else if (below > 0) {
        velocity = MAX_SPEED * Math.min(below / BAND, 1);
      } else {
        velocity = 0;
      }

      run();
    },

    stop: () => {
      velocity = 0;
      if (frame !== null) cancelAnimationFrame(frame);
      frame = null;
    },
  };
}
