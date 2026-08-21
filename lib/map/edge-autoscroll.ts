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
  /** Latest pointer position, in viewport coordinates. */
  update: (clientY: number) => void;
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
 */
export function scrollableAncestor(from: HTMLElement): HTMLElement | null {
  let element: HTMLElement | null = from.parentElement;

  while (element) {
    const { overflowY } = getComputedStyle(element);

    if (
      (overflowY === "auto" || overflowY === "scroll") &&
      element.scrollHeight > element.clientHeight
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
    update: (clientY) => {
      const rect = container.getBoundingClientRect();

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
