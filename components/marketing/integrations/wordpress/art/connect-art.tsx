"use client";

import type { AnimationSequence } from "motion/react";

import { TiltedWindow } from "../../../steps/art/tilted-window";
import { WindowMap } from "../../../steps/art/window-map";
import {
  arriveMap,
  clearMap,
  cursorTo,
  EASE,
  holdUntil,
  HOME,
  PRESS,
  PRESSED,
} from "../../../steps/stage/pass-kit";
import { useStagePlay, type PlayMode } from "../../../steps/stage/use-stage-play";
import { MapPicker, pickRow, resetPicker } from "../../stage/map-picker";
import { StageCursor } from "../../stage/stage-cursor";

/**
 * Step three, in three beats: on our side the owner moves down their maps and
 * picks one, **Connect** ticks, and back on their WordPress page the map
 * arrives.
 */
function buildPass(root: HTMLElement): AnimationSequence {
  const to = cursorTo(root);

  return [
    ...clearMap(0),
    ['[data-art="connect-check"]', { pathLength: 0 }, { duration: 0.01, at: 0 }],
    ['[data-art="sheet"]', { opacity: 1 }, { duration: 0.35, at: 0.3 }],

    // Down the list.
    ['[data-art="cursor"]', to('[data-pick-row="1"]'), { duration: 0.5, ease: EASE, at: 0.75 }],
    ...pickRow(0, 1, 1.0),
    ['[data-art="cursor"]', to('[data-pick-row="2"]'), { duration: 0.35, ease: EASE, at: 1.4 }],
    ...pickRow(1, 2, 1.55),
    ['[data-art="cursor"]', PRESS, { duration: 0.3, at: 1.85 }],

    // Connect.
    ['[data-art="cursor"]', to('[data-art="connect"]'), { duration: 0.45, ease: EASE, at: 2.2 }],
    ['[data-art="cursor"]', PRESS, { duration: 0.3, at: 2.7 }],
    ['[data-art="connect"]', PRESSED, { duration: 0.3, at: 2.7 }],
    ['[data-art="connect-check"]', { pathLength: 1 }, { duration: 0.3, ease: EASE, at: 2.8 }],

    // Back on WordPress.
    ['[data-art="sheet"]', { opacity: 0 }, { duration: 0.35, at: 3.25 }],
    ...arriveMap(3.45),
    ...resetPicker(2, 3.7),
    ['[data-art="cursor"]', HOME, { duration: 0.8, ease: EASE, at: 3.7 }],

    ...holdUntil(6),
  ];
}

/** Our map picker over the owner's page, then their page with the map on it. */
export default function ConnectArt({ play = "hover" }: { play?: PlayMode }) {
  const scope = useStagePlay<HTMLDivElement>(buildPass, play);

  return (
    <div ref={scope} aria-hidden="true" className="absolute inset-0 overflow-hidden">
      <TiltedWindow address="yoursite.com/stores" className="inset-x-[7%] top-[7%] bottom-[12%]">
        <div className="flex min-h-0 flex-1 flex-col gap-1.5 p-2.5">
          <span className="h-2 w-2/5 shrink-0 rounded-full bg-foreground/50" />
          <span className="h-1 w-3/5 shrink-0 rounded-full bg-foreground/15" />
          <div className="relative mt-1 min-h-0 flex-1 overflow-hidden rounded-md bg-foreground/[0.04]">
            <WindowMap />
          </div>
        </div>
        <MapPicker backdrop />
      </TiltedWindow>

      <StageCursor left="84%" top="82%" />
      <span data-art="hold" className="hidden" />
    </div>
  );
}
