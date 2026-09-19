/**
 * Where an open card goes, as pure geometry.
 *
 * Its own module rather than more of `map.ts`, and the reason is testability:
 * `map.ts` imports maplibre-gl at module scope, which touches `window` the
 * moment it is evaluated, so nothing in it can be reached from a unit test.
 * Everything here is arithmetic over rectangles plus a few DOM reads, which is
 * exactly the part worth holding still — the same argument
 * `lib/map/drop-action.ts` makes on the dashboard side.
 */

/** Air between an open card and the edge of the frame, in pixels. */
export const CARD_MARGIN = 10;

/**
 * The part of the map a card is allowed to occupy, in the frame's own pixels.
 *
 * Not the same thing as the frame, and the difference is whatever the embed
 * floats over the map: the results panel, the bottom sheet's peek strip, and a
 * floating search bar. A **docked** panel is a flex sibling of `.lm-canvas`, so
 * the map's container already excludes it and it changes nothing here; a
 * **floating** one is an overlay *inside* that container, invisible to
 * `clientWidth`, which is how a card came to open underneath it — not merely
 * hidden but unclickable, since the panel takes the pointer. Measured on the
 * publish preview: a 1120px frame, a 381px panel from x730, and a card at
 * 585-905.
 *
 * **Each overlay is cut off along whichever edge leaves the most map**, and the
 * test is two-dimensional. It used to be horizontal only, which was right for a
 * panel standing the frame's full height and badly wrong for the phone's bottom
 * sheet: its peek strip spans the map's width, so the horizontal test "cut" the
 * frame down to the 10px between the strip and the edge. Measured on the
 * publish preview at 390px: a 10px-wide usable rect, no side the card fitted
 * on, and every card flown to the bottom of the map with its pin under the
 * strip. Cutting by area turns the strip into a bottom edge and the search bar
 * into a top one, and still turns a full-height panel into a side.
 *
 * It works off the rectangles rather than the settings, so `data-lm-side` is
 * never read here and an RTL host page needs no second case. An overlay that
 * would leave no map at all — an open sheet covering the frame — is ignored:
 * there is nothing better to do with the card than the whole frame.
 */
export type UsableFrame = {
  left: number;
  top: number;
  right: number;
  bottom: number;
};

export function usableFrame(frame: HTMLElement): UsableFrame {
  let usable: UsableFrame = {
    left: 0,
    top: 0,
    right: frame.clientWidth,
    bottom: frame.clientHeight,
  };

  const root = frame.closest(".lm-root");
  if (!root) return usable;

  const box = frame.getBoundingClientRect();

  /*
   * **Where each overlay is going, not where it is this instant.**
   *
   * Tapping a row in the open sheet closes the sheet and starts the flight in
   * the same task, and the sheet slides shut on a 180ms transition — so a rect
   * read here was the *open* sheet, covering the map from y256 of 731. The card
   * was planned against the strip above it, cut to 161px of its 300, and flown
   * in that way; `placeCard` re-measured at `moveend`, found the sheet gone and
   * grew the card to full height *after* the landing. Reported as "half the
   * card shows while it flies and the rest loads when the flight ends". The
   * side drawer has the same shape on the other axis.
   *
   * So every running transition in the embed is put at its end, the rects are
   * read, and each is put back where it was — all in one task, so nothing
   * paints in between and the slide itself is untouched. The whole subtree,
   * because a search bar docked in the sheet moves with the sheet's transform
   * and has no transition of its own. Transitions only: MapLibre's location
   * dot pulses forever, and an infinite end time is not a time. And only those
   * with a time to put back, since restoring `null` onto one that has gained a
   * time in between throws.
   */
  const moving = root
    .getAnimations({ subtree: true })
    .filter(
      (animation) =>
        animation instanceof CSSTransition && animation.currentTime !== null,
    );
  const now = moving.map((animation) => {
    const at = animation.currentTime;
    animation.currentTime =
      animation.effect?.getComputedTiming().endTime ?? null;
    return at;
  });

  const rects = [...root.querySelectorAll(".lm-panel, .lm-toolbar")].map(
    (overlay) => overlay.getBoundingClientRect(),
  );

  moving.forEach((animation, index) => {
    animation.currentTime = now[index];
  });

  for (const rect of rects) {
    // In the frame's own coordinates, so everything below is one arithmetic.
    const left = rect.left - box.left;
    const right = rect.right - box.left;
    const top = rect.top - box.top;
    const bottom = rect.bottom - box.top;

    // Not over what is left of the map: docked, stacked, hidden, or inside a
    // panel that has already been cut away.
    if (
      right <= usable.left ||
      left >= usable.right ||
      bottom <= usable.top ||
      top >= usable.bottom
    ) {
      continue;
    }

    let best = usable;
    let most = 0;

    for (const cut of [
      { ...usable, left: right },
      { ...usable, right: left },
      { ...usable, top: bottom },
      { ...usable, bottom: top },
    ]) {
      // One side moves per cut, so a negative area is a cut past the far edge.
      const area = (cut.right - cut.left) * (cut.bottom - cut.top);

      if (area > most) {
        most = area;
        best = cut;
      }
    }

    usable = best;
  }

  return usable;
}

/**
 * The side a card opens on, in MapLibre's anchor words: `left` is the card to
 * the *right* of the pin (the edge of the card that is pinned — MapLibre's
 * convention, which reads backwards until it has caught you once), `top` is the
 * card below it.
 *
 * **Beside the pin wherever the card takes no more than half the room, below it
 * everywhere else.** One side on a given map rather than whichever side happens
 * to be cheapest per pin, because that is what the owner asked for and what a
 * visitor can learn: on a desktop the card is always to the right of the pin it
 * belongs to, on a phone the pin is at the top and the card underneath it. It
 * used to be "least movement wins, above the pin on a tie", which on an ordinary
 * frame meant above for one pin, below for the next and beside for a third.
 *
 * Half, because a card beside its pin needs the pin's own room as well as the
 * card's, and a card wider than half the map leaves too little of the map
 * beside it to be worth the pin landing hard against the edge. It is also what
 * makes the answer the phone one on a phone without a breakpoint: the narrowest
 * card `CARD_LIMITS` allows is 220px, and a phone's map is under 440px wide.
 */
export type CardSide = "left" | "top";

export function cardSide(width: number, usable: UsableFrame): CardSide {
  return usable.right - usable.left >= 2 * width ? "left" : "top";
}

/**
 * Where the pin has to be for its card to fit, and how tall the card may be if
 * nothing fits.
 *
 * `x`/`y` is the point nearest the one asked about from which the whole card
 * clears every edge of the *usable* rect by `CARD_MARGIN`. Asked with where the
 * pin *is*, the difference is the least the map has to move — zero on a frame
 * with room, which is most pins. `cap` is set only when the card is taller than
 * the frame can hold on its side at all; the pin then goes where the most of the
 * card shows (the top, for a card below it; the middle, for a card beside it)
 * and the card is cut to `cap` and scrolls inside itself.
 *
 * `pair` is the flight's question rather than the settle's. A flight moves the
 * camera anyway, so there is nothing to save by moving it less, and it is asked
 * with the centre of the frame: aiming at the centre *less half the card* lands
 * the pin and its card as one group in the middle of the map, instead of the pin
 * dead centre and the card hanging off one side of it.
 *
 * `width` and `height` are MapLibre's container, tip included — measured with
 * this side already applied, since the tip is part of the width on one side and
 * of the height on the other.
 */
export type CardPlacement = { x: number; y: number; cap?: number };

export function cardPlacement(
  side: CardSide,
  width: number,
  height: number,
  usable: UsableFrame,
  gap: number,
  pointX: number,
  pointY: number,
  pair?: boolean,
): CardPlacement {
  const m = CARD_MARGIN;
  const { left, top, right, bottom } = usable;
  const beside = side === "left";

  if (pair) {
    if (beside) pointX -= width / 2;
    else pointY -= height / 2;
  }

  /*
   * The pin keeps `gap` from the edge it is pushed against — the popup offset is
   * the pin's radius plus 6px — so a pin at the limit is still whole on screen.
   */
  const x = within(
    pointX,
    beside ? left + gap : left + width / 2 + m,
    beside ? right - width - gap - m : right - width / 2 - m,
  );
  const low = beside ? top + height / 2 + m : top + gap;
  const high = beside ? bottom - height / 2 - m : bottom - height - gap - m;

  if (low <= high) return { x, y: within(pointY, low, high) };

  const y = beside ? (top + bottom) / 2 : low;

  return { x, y, cap: beside ? bottom - top - 2 * m : bottom - y - gap - m };
}

/** Clamped into `[low, high]`, or the middle of it where it is inside out. */
function within(value: number, low: number, high: number): number {
  return low > high ? (low + high) / 2 : Math.min(Math.max(value, low), high);
}
