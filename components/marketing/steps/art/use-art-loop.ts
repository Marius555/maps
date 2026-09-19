"use client";

import {
  inView,
  useAnimate,
  useReducedMotion,
  type AnimationSequence,
} from "motion/react";
import { useEffect } from "react";

/**
 * Plays a drawing's animation on repeat, but only while it is on screen.
 *
 * Built the first time the drawing scrolls into view, paused when it leaves and
 * resumed where it stopped when it comes back — three loops running under the
 * fold would be CPU spent on nobody.
 *
 * **Every sequence given to this must start and end on the drawing as the
 * server rendered it.** That is what makes it safe: nothing is hidden in the
 * HTML waiting for a script (the reveal.tsx rule), nothing snaps when the loop
 * starts, and each repeat picks up exactly where the last one put things down.
 *
 * The trap in that: a sequence holds each track's *first keyframe* from time
 * zero, not from the segment's own `at`. So an explicit list like
 * `opacity: [0.5, 0]` puts the element at 0.5 from the moment the loop starts.
 * Give a single target (it animates from wherever the element is) or start the
 * list at the element's resting value.
 *
 * Under reduced motion nothing starts, and the server's drawing — a finished
 * frame of the loop — is the static form.
 */
export function useArtLoop<T extends Element>(
  sequence: AnimationSequence,
  repeatDelay = 1.2,
) {
  const [scope, animate] = useAnimate<T>();
  const reduced = useReducedMotion();

  useEffect(() => {
    const element = scope.current;
    if (reduced || !element) return;

    let controls: ReturnType<typeof animate> | null = null;

    const stopWatching = inView(
      element,
      () => {
        if (controls) controls.play();
        else controls = animate(sequence, { repeat: Infinity, repeatDelay });

        return () => controls?.pause();
      },
      { amount: 0.5 },
    );

    return () => {
      stopWatching();
      controls?.stop();
    };
  }, [animate, reduced, repeatDelay, scope, sequence]);

  return scope;
}
