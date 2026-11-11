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
  typing,
} from "../../../steps/stage/pass-kit";
import { useStagePlay, type PlayMode } from "../../../steps/stage/use-stage-play";
import { StageCursor } from "../../stage/stage-cursor";
import { WpEditorBar } from "./wp-editor-bar";

const CODE = '<script type="module" src="…/map.js"></script>';
const TYPE = typing(CODE.length);

/**
 * Three beats: the HTML block empties, the embed line types itself in, and the
 * map arrives under it.
 */
function buildPass(root: HTMLElement): AnimationSequence {
  const to = cursorTo(root);

  return [
    ...clearMap(0),
    ['[data-art="code"]', { clipPath: "inset(0% 100% 0% 0%)" }, { duration: 0.25, at: 0.3 }],

    // Click into the block and paste.
    ['[data-art="cursor"]', to('[data-art="code-box"]', { x: -60 }), { duration: 0.7, ease: EASE, at: 0.6 }],
    ['[data-art="cursor"]', PRESS, { duration: 0.3, at: 1.35 }],
    ['[data-art="code"]', { clipPath: "inset(0% 0% 0% 0%)" }, { duration: 1.0, ease: TYPE, at: 1.5 }],
    ['[data-art="cursor"]', HOME, { duration: 0.8, ease: EASE, at: 1.7 }],

    // The map arrives.
    ...arriveMap(2.6),

    ...holdUntil(5.6),
  ];
}

/**
 * An editor with an HTML block holding the embed line, and the map under it.
 * `label` is what the block is called: WordPress's "Custom HTML" by default,
 * "Embed" on the any-website page, where it stands for every builder's version
 * — and plays on view there, as that page's lead drawing.
 */
export default function HtmlBlockArt({
  label = "Custom HTML",
  play = "hover",
}: {
  label?: string;
  play?: PlayMode;
}) {
  const scope = useStagePlay<HTMLDivElement>(buildPass, play);

  return (
    <div ref={scope} aria-hidden="true" className="absolute inset-0 overflow-hidden">
      <TiltedWindow bar={<WpEditorBar />} className="inset-x-[7%] top-[7%] bottom-[12%]">
        <div className="flex min-h-0 flex-1 flex-col gap-1 px-[8%] pt-3 pb-3">
          {/* The block's label, the way the editor tags a selected block. */}
          <span className="w-fit rounded-[3px] bg-foreground/[0.08] px-1.5 py-1 text-[7px] leading-none font-semibold text-foreground">
            {label}
          </span>

          {/* The code, dark on light — the darkest thing in the drawing. */}
          <div data-art="code-box" className="rounded-md bg-foreground px-2 py-1.5 font-mono text-[7.5px] leading-none text-background">
            <span data-art="code" className="block truncate" style={{ clipPath: "inset(0% 0% 0% 0%)" }}>
              {CODE}
            </span>
          </div>

          <div className="relative mt-1 min-h-0 flex-1 overflow-hidden rounded-md bg-foreground/[0.04]">
            <WindowMap />
          </div>
        </div>
      </TiltedWindow>

      <StageCursor left="84%" top="82%" />
      <span data-art="hold" className="hidden" />
    </div>
  );
}
