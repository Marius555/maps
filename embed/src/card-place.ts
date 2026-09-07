/**
 * Where an open card goes, as pure geometry.
 *
 * Its own module rather than more of `map.ts`, and the reason is testability:
 * `map.ts` imports maplibre-gl at module scope, which touches `window` the
 * moment it is evaluated, so nothing in it can be reached from a unit test.
 * Everything here is arithmetic over rectangles plus one DOM read, which is
 * exactly the part worth holding still — the same argument
 * `lib/map/drop-action.ts` makes on the dashboard side.
 *
 * `PositionAnchor` is a type-only import and so is erased: this module adds
 * nothing to what the embed downloads.
 */

import type { PositionAnchor } from "maplibre-gl";

/** Air between an open card and the edge of the frame, in pixels. */
export const CARD_MARGIN = 10;

/**
 * Room left below a pin that a card has been pushed to the bottom of the frame
 * for, so the pin it belongs to is still on screen and still clickable.
 *
 * Roughly a pin's own height — see `PIN_POPUP_OFFSET`, which is measured from
 * the same drawing.
 */
export const PIN_ROOM = 28;

/**
 * The part of the map a card is allowed to occupy, in the frame's own pixels.
 *
 * Not the same thing as the frame, and the difference is the results panel. A
 * **docked** panel is a flex sibling of `.lm-canvas`, so the map's container
 * already excludes it and this changes nothing; a **floating** one is an overlay
 * *inside* that container, invisible to `clientWidth`, which is how a card came
 * to open underneath it — not merely hidden but unclickable, since the panel
 * takes the pointer. Measured on the publish preview: a 1120px frame, a 381px
 * panel from x730, and a card at 585-905.
 *
 * One rule covers all three layouts because it works off the rectangles rather
 * than off the settings: docked, the panel does not intersect the frame;
 * stacked (the narrow container query) it sits below the map and does not
 * either; only floating produces a cut. Which edge is cut is decided by the
 * edge the panel is nearer, so `data-lm-side` is never read here and an RTL host
 * page needs no second case.
 */
export type UsableFrame = {
  left: number;
  top: number;
  right: number;
  bottom: number;
};

export function usableFrame(frame: HTMLElement): UsableFrame {
  const usable: UsableFrame = {
    left: 0,
    top: 0,
    right: frame.clientWidth,
    bottom: frame.clientHeight,
  };

  const panel = frame
    .closest(".lm-root")
    ?.querySelector<HTMLElement>(".lm-panel");
  if (!panel) return usable;

  const frameBox = frame.getBoundingClientRect();
  const panelBox = panel.getBoundingClientRect();

  // In the frame's own coordinates, so everything below is one arithmetic.
  const left = panelBox.left - frameBox.left;
  const right = panelBox.right - frameBox.left;

  // No horizontal overlap at all: docked, stacked, or simply switched off.
  if (right <= usable.left || left >= usable.right) return usable;

  if (left - usable.left <= usable.right - right) {
    usable.left = Math.min(right, usable.right);
  } else {
    usable.right = Math.max(left, usable.left);
  }

  return usable;
}

/**
 * The four sides a card can open on, and where the pin has to be for the whole
 * of it to fit on each.
 *
 * A band is `[anchor, minX, maxX, minY, maxY]` in the frame's own pixels: the
 * rectangle the pin may sit in for a card of this size to clear every edge of
 * the *usable* rect by `CARD_MARGIN`. Written this way round — the room the
 * *pin* needs rather than the room the card needs — because that is the form
 * both questions want. "Does it fit where the pin already is?" is a
 * point-in-rectangle test, and "how far would the map have to move for it to?"
 * is the distance from the point to that rectangle. A band whose min is past its
 * max is a side this frame is simply too small for.
 *
 * It takes the usable rect rather than a width and a height, because a floating
 * results panel makes the room the *card* has and the room the *camera* has two
 * different boxes — see `usableFrame`, and `flyToCard`, which still offsets
 * against the container's own centre because that is what MapLibre's `offset` is
 * defined against.
 *
 * `left` and `right` name the edge of the *card* that is pinned, which is
 * MapLibre's convention and reads backwards until you have been caught by it
 * once: `left` puts the card to the right of the pin.
 */
export function cardBands(
  width: number,
  height: number,
  usable: UsableFrame,
  gap: number,
): [PositionAnchor, number, number, number, number][] {
  const m = CARD_MARGIN;
  const halfW = width / 2;
  const halfH = height / 2;
  const { left, top, right, bottom } = usable;

  return [
    // Above the pin, centred on it. MapLibre's own preference, and the shape
    // people expect a map popup to have, so it is asked about first.
    ["bottom", left + halfW + m, right - halfW - m, top + height + gap + m, bottom - m],
    // Below the pin.
    ["top", left + halfW + m, right - halfW - m, top + m, bottom - height - gap - m],
    // To the right of the pin, centred on it vertically.
    ["left", left + m, right - width - gap - m, top + halfH + m, bottom - halfH - m],
    // To its left.
    ["right", left + width + gap + m, right - m, top + halfH + m, bottom - halfH - m],
  ];
}

/** Where a card fits, and what the map would have to spend to put it there. */
export type CardPlacement = {
  anchor: PositionAnchor;
  /** Where the pin has to be in the frame, in the frame's own pixels. */
  x: number;
  y: number;
  /** How far that is from where the pin is now. Zero is "already fits". */
  move: number;
};

/**
 * The nearest point of the nearest viable band, and how far away it is.
 *
 * Strictly nearer, so a tie goes to the band asked about first — which is why
 * `cardBands` is in the order it is: two sides that would both cost nothing
 * should resolve to the one people expect, not to the last one tested.
 *
 * Its own function because two callers ask it now and they must agree. The
 * settle (`placeCard`) asks it of where the pin *is*; the flight (`flyToCard`)
 * asks it of where the pin is going to *be*, which is what lets one camera move
 * arrive with the card already in the right place instead of settling into it
 * afterwards.
 */
export function chooseBand(
  bands: [PositionAnchor, number, number, number, number][],
  pointX: number,
  pointY: number,
): CardPlacement | null {
  let best: CardPlacement | null = null;

  for (const [anchor, minX, maxX, minY, maxY] of bands) {
    if (minX > maxX || minY > maxY) continue;

    const x = Math.min(Math.max(pointX, minX), maxX);
    const y = Math.min(Math.max(pointY, minY), maxY);
    const move = Math.hypot(x - pointX, y - pointY);

    if (!best || move < best.move) best = { anchor, x, y, move };
  }

  return best;
}
