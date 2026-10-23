"use client";

import { createContext, useContext } from "react";

/**
 * A step panel's hover state, shared with the drawing inside it. `StepPanel`
 * owns it, because the whole card is the thing to hover, not just the drawing;
 * the drawing reports back whether a pass is still playing, so the panel's
 * "Hover to play" chip stays away until the drawing has come to rest.
 */
export const StepHoverContext = createContext<{
  hovered: boolean;
  setPlaying: (playing: boolean) => void;
}>({ hovered: false, setPlaying: () => {} });

export const useStepHover = () => useContext(StepHoverContext);
