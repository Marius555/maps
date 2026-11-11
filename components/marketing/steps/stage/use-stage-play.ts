"use client";

import { useAnimate, useInView, type AnimationSequence } from "motion/react";

import { useStepHover } from "./step-hover";
import { usePassPlay } from "./use-pass-play";

/** When a stage drawing plays: while its panel is hovered, or while it is on screen. */
export type PlayMode = "hover" | "view";

/**
 * `useHoverPlay` and `useViewPlay` behind one switch, for a drawing that is a
 * step in one place and a page's lead picture in another — the Custom HTML
 * drawing is both, on /for/wordpress and /for/any-website.
 *
 * Both readings are taken every render and only one is used, because a hook
 * cannot be chosen conditionally. In hover mode the drawing reports back
 * whether a pass is still playing, which is what keeps `StepPanel`'s "Hover to
 * play" chip away until it has come to rest; a drawing that skipped that (the
 * old looping ones) left the chip saying "Hover to play" over a picture that
 * was already moving.
 */
export function useStagePlay<T extends HTMLElement>(
  build: (root: T) => AnimationSequence,
  mode: PlayMode,
) {
  const animator = useAnimate<T>();
  const visible = useInView(animator[0], { amount: 0.5 });
  const { hovered, setPlaying } = useStepHover();

  usePassPlay(
    animator,
    build,
    mode === "view" ? visible : hovered,
    mode === "hover" ? setPlaying : undefined,
  );

  return animator[0];
}
