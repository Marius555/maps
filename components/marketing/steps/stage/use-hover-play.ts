"use client";

import { useAnimate, type AnimationSequence } from "motion/react";

import { useStepHover } from "./step-hover";
import { usePassPlay } from "./use-pass-play";

/**
 * Plays a step drawing's animation while its panel is hovered, and never
 * before — the owner's rule for this section (2026-10-23): a page where three
 * boxes move on their own is three things shouting at once.
 *
 * The passes themselves are `usePassPlay`'s: chained, each starting and ending
 * on the drawing at rest, so leaving mid-pass lets it finish and settle. This
 * only says *when*: while the panel (`StepPanel`) is hovered, reporting back
 * whether a pass is still playing so the "Hover to play" chip can wait.
 *
 * Touch has no hover, but a tap fires `pointerenter` and `pointerleave` in one
 * go, so a tap plays one pass — which is the phone version of the same rule.
 */
export function useHoverPlay<T extends HTMLElement>(
  build: (root: T) => AnimationSequence,
) {
  const animator = useAnimate<T>();
  const { hovered, setPlaying } = useStepHover();

  usePassPlay(animator, build, hovered, setPlaying);
  return animator[0];
}
