/**
 * Where the tutorial's notes sit and how its arrows run, from measured rects.
 *
 * Pure geometry, kept out of the components so the drawing code only draws.
 *
 * **Notes stack in the order of what they point at**, top to bottom, each at
 * least `STACK` below the last. On a desktop the toolbar's pin button and the
 * sidebar's Locations link are close to level, and on a phone the menu button
 * sits right above the pin button — placed independently, the two notes land on
 * top of each other in both.
 *
 * **Every arrow is a single quarter-turn**, one cubic from the note's edge into
 * the target, leaving along one axis and arriving along the other. That is what
 * keeps it free of loops however the notes get pushed around: both control
 * points pull the same way, so the curve cannot cross itself.
 */

export type CalloutSide = "below" | "right";

export type Point = { x: number; y: number };
export type Box = { left: number; top: number; width: number; height: number };

export type CalloutInput = {
  id: string;
  /** Which of the callout's targets was found, so the note can say the right thing. */
  variant: number;
  side: CalloutSide;
  target: Box;
  note: { width: number; height: number };
};

export type PlacedCallout = {
  id: string;
  variant: number;
  ring: Box;
  note: { left: number; top: number };
  /** The arrow's shaft and its head, as SVG path data in viewport pixels. */
  shaft: string;
  head: string;
};

/** Between the target's edge and the arrow's tip. */
const GAP = 10;
/** Between the target and the ring drawn round it. */
const RING_PAD = 5;
/** The ring's corner radius, shared by the drawn ring and the scrim's hole. */
export const RING_RADIUS = 12;
/** Kept clear at the viewport's edges. */
const MARGIN = 16;
/** Between one note's foot and the next note's head. */
const STACK = 20;
/** Where a note would like to be, relative to its arrow's tip. */
const OFFSET: Record<CalloutSide, Point> = {
  below: { x: 60, y: 84 },
  right: { x: 72, y: 96 },
};

export function layoutCallouts(
  inputs: readonly CalloutInput[],
  viewport: { width: number; height: number },
): PlacedCallout[] {
  const withTips = inputs
    .map((input) => ({ ...input, tip: tipOf(input) }))
    .sort((a, b) => a.tip.y - b.tip.y);

  let floor = -Infinity;

  return withTips.map((input) => {
    const { tip, note, side } = input;
    const offset = OFFSET[side];

    const left = clamp(tip.x + offset.x, MARGIN, viewport.width - note.width - MARGIN);
    const top = clamp(
      Math.max(tip.y + offset.y, floor + STACK),
      MARGIN,
      viewport.height - note.height - MARGIN,
    );
    floor = top + note.height;

    return {
      id: input.id,
      variant: input.variant,
      ring: {
        left: input.target.left - RING_PAD,
        top: input.target.top - RING_PAD,
        width: input.target.width + RING_PAD * 2,
        height: input.target.height + RING_PAD * 2,
      },
      note: { left, top },
      ...arrow({ left, top, ...note }, tip, side),
    };
  });
}

/**
 * The scrim's outline as a `clip-path` string: the whole viewport, less a hole
 * at every ring.
 *
 * The holes are what make the targets usable through the overlay. `clip-path`
 * clips hit-testing as well as painting, so a press inside a ring reaches the
 * real control underneath while everywhere else stays covered. Rounded to the
 * ring's own radius, so the hole and the drawn ring are one shape.
 */
export function scrimClipPath(
  placed: readonly PlacedCallout[],
  viewport: { width: number; height: number },
): string {
  const outer = `M0 0 H${viewport.width} V${viewport.height} H0 Z`;
  const holes = placed.map(({ ring }) => roundedRect(ring, RING_RADIUS)).join(" ");
  return `path(evenodd, "${outer} ${holes}")`;
}

function roundedRect({ left, top, width, height }: Box, radius: number): string {
  const r = Math.min(radius, width / 2, height / 2);
  const right = left + width;
  const bottom = top + height;
  const arc = `A${r} ${r} 0 0 1`;

  return [
    `M${left + r} ${top}`,
    `H${right - r} ${arc} ${right} ${top + r}`,
    `V${bottom - r} ${arc} ${right - r} ${bottom}`,
    `H${left + r} ${arc} ${left} ${bottom - r}`,
    `V${top + r} ${arc} ${left + r} ${top} Z`,
  ].join(" ");
}

function tipOf({ side, target }: CalloutInput): Point {
  return side === "below"
    ? { x: target.left + target.width / 2, y: target.top + target.height + GAP }
    : { x: target.left + target.width + GAP, y: target.top + target.height / 2 };
}

function arrow(note: Box, tip: Point, side: CalloutSide): { shaft: string; head: string } {
  /*
   * "below" arrives travelling up. It leaves the note's left edge travelling
   * left when there is room for that turn, and its top edge otherwise — the
   * narrow-screen case, where the note is clamped to sit under the target.
   * "right" arrives travelling left and always leaves the note's top edge.
   */
  const fromSide = side === "below" && note.left - tip.x >= 36;

  const start: Point = fromSide
    ? { x: note.left - 8, y: note.top + Math.min(22, note.height / 2) }
    : { x: note.left + 28, y: note.top - 8 };

  const dx = Math.abs(start.x - tip.x);
  const dy = Math.abs(start.y - tip.y);

  const c1: Point = fromSide
    ? { x: start.x - dx * 0.55, y: start.y }
    : { x: start.x, y: start.y - dy * 0.55 };
  const c2: Point =
    side === "below"
      ? { x: tip.x, y: tip.y + dy * 0.6 }
      : { x: tip.x + dx * 0.6, y: tip.y };

  const shaft = `M${p(start)} C${p(c1)} ${p(c2)} ${p(tip)}`;

  // The head's two strokes are deliberately unequal: a symmetric head is the
  // one detail that makes a drawn arrow read as a vector icon.
  const back = side === "below" ? { x: 0, y: 1 } : { x: 1, y: 0 };
  const a = rotate(back, 0.55, 15);
  const b = rotate(back, -0.5, 12);
  const head = `M${p(add(tip, a))} L${p(tip)} L${p(add(tip, b))}`;

  return { shaft, head };
}

function rotate(v: Point, radians: number, length: number): Point {
  const cos = Math.cos(radians);
  const sin = Math.sin(radians);
  return { x: (v.x * cos - v.y * sin) * length, y: (v.x * sin + v.y * cos) * length };
}

function add(a: Point, b: Point): Point {
  return { x: a.x + b.x, y: a.y + b.y };
}

function p({ x, y }: Point): string {
  return `${Math.round(x)} ${Math.round(y)}`;
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(value, Math.max(min, max)));
}
