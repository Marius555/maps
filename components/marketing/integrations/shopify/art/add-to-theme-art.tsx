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
import { StageCheck, StageCursor } from "../../stage/stage-cursor";
import { StoreHeader } from "../../stage/store-header";

/**
 * Step three: the Publish tab's "Your store" steps inside the app, and the
 * store beside them. ① is done; **Add to theme** is pressed in ②, which ticks;
 * the map arrives on the store; ③ turns to "Up to date". The step names are the
 * app's own (docs/notes/shopify.md, "The Publish footer inside Shopify").
 */
function buildPass(root: HTMLElement): AnimationSequence {
  const to = cursorTo(root);

  return [
    ['[data-art="map-layer"]', { opacity: 0 }, { duration: 0.3, at: 0 }],
    ...clearMap(0.3),
    ['[data-art="done-2"]', { opacity: 0, scale: 0.6 }, { duration: 0.2, at: 0 }],
    ['[data-art="done-3"]', { opacity: 0, scale: 0.6 }, { duration: 0.2, at: 0 }],
    ['[data-art="step-3"]', { opacity: 0.45 }, { duration: 0.2, at: 0 }],
    ['[data-art="added"]', { opacity: 0 }, { duration: 0.2, at: 0 }],
    ['[data-art="add-theme"]', { opacity: 1 }, { duration: 0.25, at: 0.2 }],

    ['[data-art="cursor"]', to('[data-art="add-theme"]'), { duration: 0.7, ease: EASE, at: 0.6 }],
    ['[data-art="cursor"]', PRESS, { duration: 0.3, at: 1.35 }],
    ['[data-art="add-theme"]', PRESSED, { duration: 0.3, at: 1.35 }],
    ['[data-art="done-2"]', { opacity: 1, scale: 1 }, { duration: 0.35, ease: "backOut", at: 1.55 }],
    ['[data-art="add-theme"]', { opacity: 0 }, { duration: 0.25, at: 1.6 }],
    ['[data-art="added"]', { opacity: 1 }, { duration: 0.25, at: 1.8 }],

    ['[data-art="map-layer"]', { opacity: 1 }, { duration: 0.2, at: 1.8 }],
    ...arriveMap(1.85),
    ['[data-art="cursor"]', HOME, { duration: 0.8, ease: EASE, at: 2.0 }],

    ['[data-art="step-3"]', { opacity: 1 }, { duration: 0.3, at: 3.3 }],
    ['[data-art="done-3"]', { opacity: 1, scale: 1 }, { duration: 0.35, ease: "backOut", at: 3.3 }],

    ...holdUntil(5.6),
  ];
}

function Disc({ n, done }: { n: number; done: string }) {
  return (
    <span className="relative grid size-4 shrink-0 place-items-center rounded-full bg-accent text-[8px] leading-none font-semibold text-accent-foreground ring-[3px] ring-accent/20">
      {n}
      <span data-art={done} className="absolute inset-0 grid place-items-center rounded-full bg-accent text-accent-foreground">
        <StageCheck art={`${done}-check`} className="size-2.5" />
      </span>
    </span>
  );
}

export default function AddToThemeArt({ play = "hover" }: { play?: PlayMode }) {
  const scope = useStagePlay<HTMLDivElement>(buildPass, play);

  return (
    <div ref={scope} aria-hidden="true" className="absolute inset-0 overflow-hidden">
      <TiltedWindow address="yourstore.com" className="top-[12%] right-[4%] bottom-[16%] left-[46%]">
        <div className="flex min-h-0 flex-1 flex-col gap-1.5 p-2">
          <StoreHeader />
          <span className="h-1.5 w-2/5 shrink-0 rounded-full bg-foreground/50" />
          <div className="relative min-h-0 flex-1 overflow-hidden rounded-md bg-foreground/[0.04]">
            <div data-art="map-layer" className="absolute inset-0">
              <WindowMap />
            </div>
          </div>
        </div>
      </TiltedWindow>

      {/* The app's "Your store" steps. */}
      <div className="absolute top-1/2 left-[5%] z-10 flex w-[44%] -translate-y-1/2 flex-col gap-2.5 rounded-xl border border-border bg-surface p-3 text-[9px] leading-tight shadow-md">
        <span className="flex items-center text-[8px] font-semibold tracking-wide text-muted uppercase">
          Your store
          <span className="ml-auto flex items-center gap-1 font-medium tracking-normal normal-case">
            <span className="size-1.5 rounded-full bg-success" />
            Live
          </span>
        </span>

        <span className="flex items-center gap-2 font-medium text-foreground">
          <span className="grid size-4 shrink-0 place-items-center rounded-full bg-accent text-accent-foreground">
            <StageCheck art="done-1-check" className="size-2.5" />
          </span>
          Show on your storefront
        </span>

        <span className="flex flex-col gap-1.5">
          <span className="flex items-center gap-2 font-medium text-foreground">
            <Disc n={2} done="done-2" />
            Add the block to your theme
          </span>
          {/* The button while the step is current; once done, what it did, in its place. */}
          <span className="relative ml-6 grid">
            <span
              data-art="add-theme"
              className="col-start-1 row-start-1 w-fit rounded-full bg-accent px-2.5 py-1 text-[8px] leading-none font-semibold text-accent-foreground"
              style={{ opacity: 0 }}
            >
              Add to theme
            </span>
            <span data-art="added" className="col-start-1 row-start-1 self-center text-[8px] text-muted">
              In your theme
            </span>
          </span>
        </span>

        <span data-art="step-3" className="flex items-center gap-2 font-medium text-foreground">
          <Disc n={3} done="done-3" />
          Up to date
        </span>
      </div>

      <StageCursor left="40%" top="86%" />
      <span data-art="hold" className="hidden" />
    </div>
  );
}
