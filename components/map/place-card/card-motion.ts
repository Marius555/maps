/**
 * The one clock a place card and the camera share on a phone.
 *
 * Opening a card there moves the map so the pin and its card sit centred
 * together, and closing one glides the pin back to the middle. Both are two
 * animations — the card's fade and scale, the camera's ease — and run on two
 * clocks they visibly come apart: a card that has finished arriving while the
 * map is still sliding under it reads as two things happening. So both read
 * their duration and their curve from here.
 *
 * A plain module, not a `"use client"` one, so the numbers are numbers
 * wherever they are imported (CLAUDE.md, "client reference, not the value").
 */

/** Seconds, as Motion takes them. The camera multiplies by 1000. */
export const CARD_MOTION_SECONDS = 0.25;

/** The card's existing curve — a decelerating ease-out — as a cubic-bezier. */
export const CARD_MOTION_EASE = [0, 0, 0.2, 1] as const;

/** The card's own fade and scale on a wider screen, where the map holds still. */
export const CARD_FADE_SECONDS = 0.15;

/** The gap between a pin and the card beside it — `.map-card-anchor__card`'s `left`. */
export const CARD_PIN_GAP = 22;

/** Half a pin: the ball is 36px across and anchored by its centre. */
export const PIN_RADIUS = 18;
