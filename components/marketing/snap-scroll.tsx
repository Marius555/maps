"use client";

import { animate } from "motion/react";
import { useEffect } from "react";

/**
 * `lg`, the width every grid on the page switches at — and the width the CSS
 * snap starts at too (globals.css), so the two cannot disagree.
 *
 * Below it the grids stack, the sections are 1.3–1.6 screens tall by design,
 * and the page scrolls as an ordinary document: no snap and no handler.
 *
 * **Width only, with no height in it.** This used to be the CSS's mandatory
 * gate, `min-height: 44rem` included, so a laptop window shorter than 704px got
 * no handler at all and only the CSS `proximity` snap — which takes hold near a
 * boundary and nowhere else, and read as "it only moves when I'm already half
 * way there". A short window is handled by the stops instead (`snapStops`).
 */
const SNAP_GATE = "(min-width: 64rem)";

/** Scrolling somebody did not ask for, so it goes with every other animation. */
const REDUCED_MOTION = "(prefers-reduced-motion: reduce)";

/**
 * How long a lull ends a gesture.
 *
 * A trackpad fling keeps emitting `wheel` for up to a second after the fingers
 * leave, and one gesture has to mean one screen (that is what
 * `scroll-snap-stop: always` buys on the CSS side). Anything arriving closer
 * together than this is the tail of the gesture that already moved us.
 */
const GESTURE_GAP_MS = 120;

/**
 * The soonest a *held* gesture may take another step.
 *
 * Without it, a finger resting on a trackpad emits events every frame forever,
 * every one of them reads as "the same gesture", and the page stops answering
 * until the hand comes off. With it, a sustained scroll walks on about one
 * screen every two thirds of a second.
 */
const STEP_COOLDOWN_MS = 620;

/**
 * The shortest move a gesture makes. A stop nearer than this in the direction
 * of travel is where the page already is — a keyboard or scrollbar left it a
 * few pixels short — so the gesture goes on to the one after it.
 */
const MIN_STEP_PX = 24;

const DURATION = 0.5;

/** The house curve — `--duration-fast` and `Reveal` use the same one. */
const EASE = [0, 0, 0.2, 1] as const;

/**
 * The landing page's snap, brought forward to the start of the gesture.
 *
 * **Why this exists at all.** CSS scroll snapping is defined to act when a
 * scroll *ends*: the browser lets the fling play out and then pulls the page the
 * rest of the way. On a page built of whole screens that reads as arriving
 * almost at a section and then being tugged into it, which is the bug this
 * answers. There is no CSS knob for it — the timing is the spec's, not a
 * property — so the wheel is handled here and nothing else is.
 *
 * **Every gesture moves, wherever it starts.** The next stop is the next one in
 * the direction of travel, read off the page at the start of that gesture, not
 * the one nearest the page plus one — so a page left between two stops by a
 * key or the scrollbar still moves a stop, instead of waiting until it is
 * nearer the next one than the last.
 *
 * **The wheel only.** Keyboard, touch, a dragged scrollbar and a `#features`
 * jump all keep the native behaviour and the native snap; they were never late.
 * That also keeps the no-JavaScript page exactly as it is: this component
 * renders nothing, and with scripts off the CSS snap is still the whole story.
 *
 * **Mandatory snapping has to come off while we animate.** Scroll snapping
 * applies to programmatic scrolls too, so under `mandatory` every per-frame
 * `scrollTo` is re-snapped and the animation teleports to whichever point was
 * nearest. `data-snap-lock` on `<html>` suspends it for the length of the move
 * (the rule is beside the snap itself in globals.css) and comes off at the end,
 * where restoring it is a no-op because we land exactly on a snap point.
 *
 * The movement is Motion's `animate`, not a hand-rolled rAF loop, so the curve
 * is the one the rest of the app moves on.
 */
export function SnapScroll() {
  useEffect(() => {
    const gate = window.matchMedia(SNAP_GATE);
    const reduced = window.matchMedia(REDUCED_MOTION);

    let release: (() => void) | null = null;

    const sync = () => {
      const wanted = gate.matches && !reduced.matches;

      if (wanted && !release) release = bindWheel();
      else if (!wanted && release) {
        release();
        release = null;
      }
    };

    sync();
    gate.addEventListener("change", sync);
    reduced.addEventListener("change", sync);

    return () => {
      gate.removeEventListener("change", sync);
      reduced.removeEventListener("change", sync);
      release?.();
    };
  }, []);

  return null;
}

/** Takes the wheel over; returns the undo. */
function bindWheel(): () => void {
  const html = document.documentElement;

  let playing: { stop: () => void } | null = null;
  let lastEventAt = 0;
  let lastStepAt = 0;

  const settle = () => {
    playing = null;
    delete html.dataset.snapLock;
  };

  const cancel = () => {
    if (!playing) return;

    playing.stop();
    settle();
  };

  const onWheel = (event: WheelEvent) => {
    // A pinch is a zoom, and a sideways gesture is not ours.
    if (event.ctrlKey || event.defaultPrevented) return;
    if (event.deltaY === 0 || Math.abs(event.deltaY) <= Math.abs(event.deltaX)) return;

    const now = event.timeStamp;
    const sameGesture = now - lastEventAt < GESTURE_GAP_MS;
    lastEventAt = now;

    if (playing || (sameGesture && now - lastStepAt < STEP_COOLDOWN_MS)) {
      // Mid-move, or the tail of the gesture that caused it: swallow it, or the
      // browser scrolls underneath the animation.
      event.preventDefault();
      return;
    }

    const from = window.scrollY;
    // Read now rather than cached: fonts, the chart and the verdict all settle
    // after mount, and six rectangles once per gesture is nothing.
    const next = nextStop(snapStops(), from, event.deltaY > 0 ? 1 : -1);

    // Past the last screen in either direction there is nothing to move to, so
    // the event is left alone rather than eaten.
    if (next === undefined) return;

    event.preventDefault();

    html.dataset.snapLock = "";
    lastStepAt = now;
    playing = animate(from, next, {
      duration: DURATION,
      ease: EASE,
      onUpdate: (y) => window.scrollTo(0, y),
      onComplete: settle,
    });
  };

  window.addEventListener("wheel", onWheel, { passive: false });
  // Anything else the reader does wins: a key or a press ends our move rather
  // than dragging the page back out from under them.
  window.addEventListener("keydown", cancel);
  window.addEventListener("pointerdown", cancel);

  return () => {
    cancel();
    window.removeEventListener("wheel", onWheel);
    window.removeEventListener("keydown", cancel);
    window.removeEventListener("pointerdown", cancel);
  };
}

/**
 * Every position the page is allowed to rest at, read off the page rather than
 * written down.
 *
 * The CSS makes the same list from three rules (see globals.css): the header is
 * the first stop, the hero shares that screen so it is not one, and the footer
 * rests with its *end* at the viewport's bottom — which is simply the
 * document's last scroll position. On a 732px viewport that comes out as
 * 0, 732, 1464, 2196, 2928, 3660, 3769.
 *
 * **Plus one the CSS does not have: the foot of a screen taller than the
 * window.** Every section fits 704px, and a laptop window can be shorter than
 * that. Jumping top to top there would carry the last lines of a section past
 * without ever showing them, so such a section gets a second stop with its
 * bottom at the window's bottom, and the next gesture shows the rest of it
 * before moving on.
 */
function snapStops(): number[] {
  const snap = document.querySelector(".mk-snap");
  if (!snap) return [];

  const view = window.innerHeight;
  const end = Math.max(0, document.documentElement.scrollHeight - view);
  const boxes = [...snap.children].map((el) => el.getBoundingClientRect());
  const stops = [0, end];

  boxes.forEach((box, index) => {
    // The hero's screen starts at the document's top, header included.
    const top = index === 0 ? 0 : Math.round(box.top + window.scrollY);
    const bottom = Math.round(box.bottom + window.scrollY);

    stops.push(top);
    if (bottom - top > view + MIN_STEP_PX) stops.push(bottom - view);
  });

  return [...new Set(stops)].filter((top) => top <= end).sort((a, b) => a - b);
}

/** The first stop past `y` in `direction`, ignoring any the page is already at. */
function nextStop(stops: number[], y: number, direction: 1 | -1): number | undefined {
  if (direction > 0) return stops.find((stop) => stop - y >= MIN_STEP_PX);

  return stops.findLast((stop) => y - stop >= MIN_STEP_PX);
}
