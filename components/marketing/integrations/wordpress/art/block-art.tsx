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
import { BlockPlaceholder } from "../../stage/block-placeholder";
import { MapPicker, pickRow, resetPicker } from "../../stage/map-picker";
import { StageCursor } from "../../stage/stage-cursor";
import { PostLines, WpEditorBar } from "./wp-editor-bar";

/**
 * The whole round trip in one pass, after a beat on the finished page:
 *
 * 1. **The block as inserted.** The map fades off the post, leaving the dashed
 *    placeholder, and is emptied while nobody can see it.
 * 2. **Set up this map** is pressed.
 * 3. **Choose a map**: our sheet rises over the editor, the second map is
 *    picked and **Connect** ticks.
 * 4. **The map arrives** the way the landing page's does: the ground spreads,
 *    the pins drop, the route draws.
 */
function buildPass(root: HTMLElement): AnimationSequence {
  const to = cursorTo(root);

  return [
    ['[data-art="map-layer"]', { opacity: 0 }, { duration: 0.4, at: 0.8 }],
    ...clearMap(1.25),
    ['[data-art="connect-check"]', { pathLength: 0 }, { duration: 0.01, at: 1.25 }],

    // Set up this map.
    ['[data-art="cursor"]', to('[data-art="setup"]'), { duration: 0.8, ease: EASE, at: 1.4 }],
    ['[data-art="cursor"]', PRESS, { duration: 0.3, at: 2.25 }],
    ['[data-art="setup"]', PRESSED, { duration: 0.3, at: 2.25 }],

    // Choose a map, Connect.
    ['[data-art="sheet"]', { opacity: 1 }, { duration: 0.3, at: 2.6 }],
    ['[data-art="sheet-card"]', { y: [10, 0] }, { duration: 0.35, ease: EASE, at: 2.6 }],
    ['[data-art="cursor"]', to('[data-pick-row="1"]'), { duration: 0.5, ease: EASE, at: 2.9 }],
    ['[data-art="cursor"]', PRESS, { duration: 0.3, at: 3.45 }],
    ...pickRow(0, 1, 3.5),
    ['[data-art="cursor"]', to('[data-art="connect"]'), { duration: 0.45, ease: EASE, at: 3.8 }],
    ['[data-art="cursor"]', PRESS, { duration: 0.3, at: 4.3 }],
    ['[data-art="connect"]', PRESSED, { duration: 0.3, at: 4.3 }],
    ['[data-art="connect-check"]', { pathLength: 1 }, { duration: 0.3, ease: EASE, at: 4.4 }],
    ['[data-art="sheet"]', { opacity: 0 }, { duration: 0.3, at: 4.85 }],
    ['[data-art="sheet-card"]', { y: 10 }, { duration: 0.3, ease: EASE, at: 4.85 }],

    // The map arrives.
    ['[data-art="map-layer"]', { opacity: 1 }, { duration: 0.25, at: 5.1 }],
    ...arriveMap(5.15),
    ['[data-art="cursor"]', HOME, { duration: 0.8, ease: EASE, at: 5.3 }],
    ...resetPicker(1, 5.3),

    ...holdUntil(8.5),
  ];
}

/**
 * /for/wordpress's lead drawing: the block editor with the Pinglide map block
 * in a post, set up from start to finish. Plays by itself while on screen; at
 * rest it is the finished page.
 */
export default function WordPressBlockArt({ play = "view" }: { play?: PlayMode }) {
  const scope = useStagePlay<HTMLDivElement>(buildPass, play);

  return (
    <div ref={scope} aria-hidden="true" className="absolute inset-0 overflow-hidden">
      <TiltedWindow bar={<WpEditorBar />} className="inset-x-[6%] top-[6%] bottom-[10%]">
        <div className="flex min-h-0 flex-1 flex-col gap-1.5 px-[9%] pt-3 pb-3">
          <PostLines />
          <div className="relative mt-1 min-h-0 flex-1">
            <BlockPlaceholder />
            <div
              data-art="map-layer"
              className="absolute inset-0 overflow-hidden rounded-md border border-border bg-surface"
            >
              <WindowMap />
            </div>
          </div>
        </div>
        <MapPicker />
      </TiltedWindow>

      <StageCursor left="82%" top="80%" />
      <span data-art="hold" className="hidden" />
    </div>
  );
}
