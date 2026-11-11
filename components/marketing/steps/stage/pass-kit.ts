import { stagger, type AnimationSequence } from "motion/react";

import { REVEAL_R } from "../art/window-map";

/**
 * The pieces every stage drawing's pass is written from — the landing page's
 * steps and the platform pages' drawings alike, so a cursor presses, a map
 * arrives and a line types itself the same way on every page of the site.
 *
 * Everything here is measured or timed, never placed: the drawings are HTML in
 * boxes whose width changes at every breakpoint, so a pass reads positions off
 * the page at the start of each run (`centreOf`, `cursorTo`) rather than
 * carrying numbers that are right at one width.
 */

/** The house curve for anything that travels. */
export const EASE = [0.4, 0, 0.2, 1] as const;

/** A press: the cursor dips and comes back. */
export const PRESS = { scale: [1, 0.78, 1] };

/** A button answering a press. */
export const PRESSED = { scale: [1, 0.94, 1] };

/** Typing, one character of `chars` at a time — for an animated `clipPath`. */
export const typing = (chars: number) => (t: number) => Math.round(t * chars) / chars;

type Point = { x: number; y: number };

/** The centre of the first match, relative to `root`'s box. */
export function centreOf(root: HTMLElement, selector: string): Point {
  const box = root.getBoundingClientRect();
  const r = root.querySelector(selector)?.getBoundingClientRect();

  return r
    ? { x: r.left + r.width / 2 - box.left, y: r.top + r.height / 2 - box.top }
    : { x: 0, y: 0 };
}

/**
 * Where to move `[data-art="cursor"]` so its tip lands on a selector's centre:
 * an `x`/`y` offset from where it rests. Read at the start of a pass, which
 * always begins with the cursor at rest (every pass sends it home).
 */
export function cursorTo(root: HTMLElement) {
  const box = root.getBoundingClientRect();
  const cursor = root.querySelector('[data-art="cursor"]')?.getBoundingClientRect();
  const tip = cursor ? { x: cursor.left - box.left, y: cursor.top - box.top } : { x: 0, y: 0 };

  return (selector: string, nudge: Partial<Point> = {}): Point => {
    const target = centreOf(root, selector);
    return { x: target.x - tip.x + (nudge.x ?? 0), y: target.y - tip.y + (nudge.y ?? 0) };
  };
}

/** Back where it rests. */
export const HOME = { x: 0, y: 0 };

/**
 * A `WindowMap` emptying: the ground shrinks to its middle, the pins lift and
 * the route goes. `scope` narrows the selectors to one map when a drawing has
 * two (`'[data-art="site"] '`).
 */
export function clearMap(at: number, scope = ""): AnimationSequence {
  return [
    [`${scope}[data-art="reveal"]`, { r: 0 }, { duration: 0.4, ease: "easeIn", at }],
    [`${scope}[data-wpin]`, { y: -6, opacity: 0 }, { duration: 0.25, at }],
    [`${scope}[data-art="route"]`, { opacity: 0 }, { duration: 0.2, at }],
    [`${scope}[data-art="route"]`, { pathLength: 0 }, { duration: 0.01, at: at + 0.25 }],
  ];
}

/**
 * A `WindowMap` arriving, as the showcase map does: the ground spreads from the
 * middle, the pins drop one after another, and the route draws itself. Takes
 * about 1.65s; the map is at rest after that.
 */
export function arriveMap(at: number, scope = ""): AnimationSequence {
  return [
    [`${scope}[data-art="reveal"]`, { r: REVEAL_R }, { duration: 0.9, ease: "easeOut", at }],
    [
      `${scope}[data-wpin]`,
      { y: 0, opacity: 1 },
      { duration: 0.4, ease: "backOut", delay: stagger(0.07), at: at + 0.2 },
    ],
    [`${scope}[data-art="route"]`, { opacity: 1 }, { duration: 0.01, at: at + 0.75 }],
    [`${scope}[data-art="route"]`, { pathLength: 1 }, { duration: 0.9, ease: EASE, at: at + 0.75 }],
  ];
}

/**
 * Holds the finished frame until `at` before the next pass begins. Needs a
 * `<span data-art="hold" className="hidden" />` in the drawing.
 */
export const holdUntil = (at: number): AnimationSequence => [
  ['[data-art="hold"]', { opacity: 1 }, { duration: 0.01, at }],
];
