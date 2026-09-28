"use client";

import { type RefObject, useEffect, useState } from "react";

import type { Callout } from "./callouts";
import { type CalloutInput, type PlacedCallout, layoutCallouts } from "./tutorial-layout";

/**
 * The tutorial's layout, re-measured every frame while the overlay is up.
 *
 * A frame loop rather than observers, because nothing single moves the targets.
 * The sidebar collapsing slides the toolbar sideways without resizing it; the
 * toolbar itself mounts a beat after the page; the mobile header comes and goes
 * at `md`. Two `getBoundingClientRect` calls a frame, compared before any
 * render, cost less than the observers it would take to catch each of those —
 * and the overlay is on screen for seconds, once.
 *
 * `null` until the first frame, so nothing is drawn at 0,0 before it is placed.
 * The viewport comes back with the callouts because the scrim's holes are cut
 * against the same numbers the callouts were placed in.
 */
export type TutorialLayout = {
  callouts: PlacedCallout[];
  viewport: { width: number; height: number };
};

export function useTutorialLayout(
  rootRef: RefObject<HTMLElement | null>,
  callouts: readonly Callout[],
): TutorialLayout | null {
  const [layout, setLayout] = useState<TutorialLayout | null>(null);

  useEffect(() => {
    let frame = 0;
    let last = "";

    const tick = () => {
      const next = measure(rootRef.current, callouts);
      const key = JSON.stringify(next);

      if (key !== last) {
        last = key;
        setLayout(next);
      }

      frame = requestAnimationFrame(tick);
    };

    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [rootRef, callouts]);

  return layout;
}

function measure(
  root: HTMLElement | null,
  callouts: readonly Callout[],
): TutorialLayout {
  const inputs: CalloutInput[] = [];

  for (const callout of callouts) {
    const note = root?.querySelector<HTMLElement>(`[data-tutorial-note="${callout.id}"]`);
    if (!note) continue;

    for (const [variant, target] of callout.targets.entries()) {
      const element = document.querySelector(`[data-tutorial="${target.selector}"]`);
      const rect = element?.getBoundingClientRect();

      // Zero-sized is "not on screen": the desktop sidebar below `md` is
      // `display: none`, which still leaves its links in the DOM.
      if (!rect || rect.width === 0 || rect.height === 0) continue;

      inputs.push({
        id: callout.id,
        variant,
        side: target.side,
        target: { left: rect.left, top: rect.top, width: rect.width, height: rect.height },
        note: { width: note.offsetWidth, height: note.offsetHeight },
      });
      break;
    }
  }

  const viewport = {
    width: document.documentElement.clientWidth,
    height: document.documentElement.clientHeight,
  };

  return { callouts: layoutCallouts(inputs, viewport), viewport };
}
