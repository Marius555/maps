"use client";

import type { AnimationSequence } from "motion/react";

import { TiltedWindow } from "../../../steps/art/tilted-window";
import {
  cursorTo,
  EASE,
  holdUntil,
  HOME,
  PRESS,
  PRESSED,
  typing,
} from "../../../steps/stage/pass-kit";
import { useStagePlay, type PlayMode } from "../../../steps/stage/use-stage-play";
import { BlockPlaceholder } from "../../stage/block-placeholder";
import { PinGlyph, StageCursor } from "../../stage/stage-cursor";
import { PostLines, WpEditorBar } from "./wp-editor-bar";

const QUERY = "Pinglide";
const TYPE = typing(QUERY.length);

/**
 * Step two, in three beats: the inserter opens, "Pinglide" is typed and the
 * other blocks fade back, and the Pinglide map block drops into the post.
 */
function buildPass(root: HTMLElement): AnimationSequence {
  const to = cursorTo(root);

  return [
    ['[data-art="block"]', { opacity: 0, y: -6 }, { duration: 0.3, at: 0 }],
    ['[data-art="type"]', { clipPath: "inset(0% 100% 0% 0%)" }, { duration: 0.01, at: 0.3 }],

    // Open the inserter.
    ['[data-art="cursor"]', to('[data-art="plus"]'), { duration: 0.7, ease: EASE, at: 0.4 }],
    ['[data-art="cursor"]', PRESS, { duration: 0.3, at: 1.15 }],
    ['[data-art="plus"]', PRESSED, { duration: 0.3, at: 1.15 }],
    ['[data-art="panel"]', { opacity: 1, y: [-6, 0] }, { duration: 0.3, ease: EASE, at: 1.3 }],

    // Search.
    ['[data-art="type"]', { clipPath: "inset(0% 0% 0% 0%)" }, { duration: 0.7, ease: TYPE, at: 1.55 }],
    ['[data-tile="other"]', { opacity: 0.25 }, { duration: 0.25, at: 2.3 }],
    ['[data-art="tile-ring"]', { opacity: 1 }, { duration: 0.25, at: 2.3 }],

    // Pick it.
    ['[data-art="cursor"]', to('[data-art="tile-ours"]'), { duration: 0.5, ease: EASE, at: 2.4 }],
    ['[data-art="cursor"]', PRESS, { duration: 0.3, at: 3.0 }],
    ['[data-art="tile-ours"]', PRESSED, { duration: 0.3, at: 3.0 }],
    ['[data-art="panel"]', { opacity: 0, y: -6 }, { duration: 0.25, at: 3.2 }],
    ['[data-tile="other"]', { opacity: 1 }, { duration: 0.01, at: 3.5 }],
    ['[data-art="tile-ring"]', { opacity: 0 }, { duration: 0.01, at: 3.5 }],
    ['[data-art="block"]', { opacity: 1, y: 0 }, { duration: 0.45, ease: "backOut", at: 3.35 }],
    ['[data-art="cursor"]', HOME, { duration: 0.8, ease: EASE, at: 3.9 }],

    ...holdUntil(5.2),
  ];
}

/** The block editor, its + inserter, and the block it adds. */
export default function InsertArt({ play = "hover" }: { play?: PlayMode }) {
  const scope = useStagePlay<HTMLDivElement>(buildPass, play);

  return (
    <div ref={scope} aria-hidden="true" className="absolute inset-0 overflow-hidden">
      <TiltedWindow bar={<WpEditorBar />} className="inset-x-[7%] top-[7%] bottom-[12%]">
        <div className="flex min-h-0 flex-1 flex-col gap-1.5 px-[10%] pt-3 pb-3">
          <PostLines />
          <div data-art="block" className="relative mt-1 min-h-0 flex-1">
            <BlockPlaceholder />
          </div>
        </div>

        {/* The inserter. Hidden in the finished frame. */}
        <div
          data-art="panel"
          className="absolute top-1.5 left-2 z-10 w-[46%] rounded-lg border border-border bg-surface p-1.5 shadow-lg"
          style={{ opacity: 0 }}
        >
          <div className="flex items-center gap-1 rounded-md bg-foreground/[0.05] px-1.5 py-1 text-[8px] leading-none">
            <svg viewBox="0 0 16 16" className="size-2.5 shrink-0 text-muted" fill="none" aria-hidden="true">
              <circle cx="7" cy="7" r="4.5" stroke="currentColor" strokeWidth="1.8" />
              <path d="M10.5 10.5L14 14" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
            </svg>
            <span data-art="type" className="font-medium text-foreground" style={{ clipPath: "inset(0% 0% 0% 0%)" }}>
              {QUERY}
            </span>
          </div>

          <div className="mt-1.5 grid grid-cols-3 gap-1">
            <span
              data-art="tile-ours"
              className="relative flex aspect-square flex-col items-center justify-center gap-1 rounded-md bg-accent/12"
            >
              <span data-art="tile-ring" className="absolute inset-0 rounded-md ring-[1.5px] ring-accent" style={{ opacity: 0 }} />
              <PinGlyph />
              <span className="text-[6px] leading-none font-medium text-foreground">Pinglide map</span>
            </span>
            {[0, 1, 2, 3, 4].map((index) => (
              <span
                key={index}
                data-tile="other"
                className="flex aspect-square flex-col items-center justify-center gap-1 rounded-md bg-foreground/[0.05]"
              >
                <span className="h-1.5 w-2.5 rounded-[2px] bg-foreground/25" />
                <span className="h-0.5 w-1/2 rounded-full bg-foreground/20" />
              </span>
            ))}
          </div>
        </div>
      </TiltedWindow>

      <StageCursor left="84%" top="82%" />
      <span data-art="hold" className="hidden" />
    </div>
  );
}
