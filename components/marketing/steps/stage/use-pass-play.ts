"use client";

import {
  useReducedMotion,
  type AnimationPlaybackControls,
  type AnimationScope,
  type AnimationSequence,
  type useAnimate,
} from "motion/react";
import { useEffect, useRef } from "react";

/**
 * Plays a stage drawing's animation one pass at a time for as long as `wanted`
 * is true — the engine under `useHoverPlay` (the steps) and `useViewPlay` (the
 * Sources drawing), which differ only in what makes it wanted. The animating
 * is Motion's: the caller's `useAnimate` scope and `animate`, given a sequence.
 *
 * **One pass at a time, chained, not `repeat: Infinity`.** While wanted, a
 * finished pass starts the next; once not, the pass in flight finishes and the
 * drawing comes to rest. That only works because **every sequence starts and
 * ends on the drawing as first rendered** — the rest frame is a finished frame
 * of the loop, so nothing snaps at either end, and it is also the whole static
 * form under reduced motion, where nothing ever plays.
 *
 * `build` gets the drawing's root and runs at the start of every pass, so a
 * sequence can be measured at play time (pins standing on a 3D plane are a
 * perspective projection, wherever the panel's width has put them).
 *
 * The sequence trap useArtLoop documented still holds: a sequence holds each
 * track's *first keyframe* from time zero. Give single targets, or start a
 * keyframe list at the element's resting value.
 */
export function usePassPlay<T extends HTMLElement>(
  [scope, animate]: [AnimationScope<T>, ReturnType<typeof useAnimate>[1]],
  build: (root: T) => AnimationSequence,
  wanted: boolean,
  onPlaying?: (playing: boolean) => void,
) {
  const reduced = useReducedMotion() ?? false;

  const wantedRef = useRef(false);
  const running = useRef<AnimationPlaybackControls | null>(null);
  const buildRef = useRef(build);
  const onPlayingRef = useRef(onPlaying);

  useEffect(() => {
    buildRef.current = build;
    onPlayingRef.current = onPlaying;
  });

  useEffect(() => {
    wantedRef.current = wanted && !reduced;
    if (!wantedRef.current || running.current) return;

    const pass = () => {
      const root = scope.current;
      if (!root) return;

      const controls = animate(buildRef.current(root));
      running.current = controls;
      onPlayingRef.current?.(true);

      controls.then(() => {
        if (running.current !== controls) return;
        if (wantedRef.current) {
          pass();
        } else {
          running.current = null;
          onPlayingRef.current?.(false);
        }
      });
    };

    pass();
  }, [animate, reduced, scope, wanted]);

  useEffect(
    () => () => {
      running.current?.stop();
      running.current = null;
    },
    [],
  );
}
