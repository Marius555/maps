"use client";

import { useAnimate, useInView, type AnimationSequence } from "motion/react";

import { usePassPlay } from "./use-pass-play";

/**
 * Plays a stage drawing on its own, pass after pass, while at least half of it
 * is on screen — the Sources drawing's rule (owner, 2026-10-23: it plays like
 * an ordinary animation, not on hover). Scrolled away, the pass in flight
 * finishes and it rests on its finished frame; nothing runs under the fold.
 *
 * Not `useArtLoop`, because that loops one fixed sequence and this drawing's
 * sequence is measured at play time (`usePassPlay`). Visibility is Motion's
 * `useInView`, on the same scope `useAnimate` animates.
 */
export function useViewPlay<T extends HTMLElement>(
  build: (root: T) => AnimationSequence,
) {
  const animator = useAnimate<T>();
  const visible = useInView(animator[0], { amount: 0.5 });

  usePassPlay(animator, build, visible);
  return animator[0];
}
