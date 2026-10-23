"use client";

import {
  useAnimate,
  useReducedMotion,
  type AnimationPlaybackControls,
  type AnimationSequence,
} from "motion/react";
import { useEffect, useRef } from "react";

import { useStepHover } from "./step-hover";

/**
 * Plays a step drawing's animation while its panel is hovered, and never
 * before — the owner's rule for this section (2026-10-23): a page where three
 * boxes move on their own is three things shouting at once.
 *
 * **One pass at a time, chained, not `repeat: Infinity`.** While the pointer
 * stays, a finished pass starts the next; once it leaves, the pass in flight
 * finishes and the drawing comes to rest. That only works because **every
 * sequence starts and ends on the drawing as first rendered** — the rest frame
 * is a finished frame of the loop, so nothing snaps at either end, and it is
 * also the whole static form under reduced motion, where nothing ever plays.
 *
 * Touch has no hover, but a tap fires `pointerenter` and `pointerleave` in one
 * go, so a tap plays one pass — which is the phone version of the same rule.
 *
 * `build` gets the drawing's root, so a sequence can be measured at play time
 * (the import drawing flies dots onto pins whose position is a 3D projection).
 *
 * The sequence trap useArtLoop documented still holds: a sequence holds each
 * track's *first keyframe* from time zero. Give single targets, or start a
 * keyframe list at the element's resting value.
 */
export function useHoverPlay<T extends HTMLElement>(
  build: (root: T) => AnimationSequence,
) {
  const [scope, animate] = useAnimate<T>();
  const reduced = useReducedMotion() ?? false;
  const { hovered, setPlaying } = useStepHover();

  const wanted = useRef(false);
  const running = useRef<AnimationPlaybackControls | null>(null);
  const buildRef = useRef(build);

  useEffect(() => {
    buildRef.current = build;
  });

  useEffect(() => {
    wanted.current = hovered && !reduced;
    if (!wanted.current || running.current) return;

    const pass = () => {
      const root = scope.current;
      if (!root) return;

      const controls = animate(buildRef.current(root));
      running.current = controls;
      setPlaying(true);

      controls.then(() => {
        if (running.current !== controls) return;
        if (wanted.current) {
          pass();
        } else {
          running.current = null;
          setPlaying(false);
        }
      });
    };

    pass();
  }, [animate, hovered, reduced, scope, setPlaying]);

  useEffect(
    () => () => {
      running.current?.stop();
      running.current = null;
    },
    [],
  );

  return scope;
}
