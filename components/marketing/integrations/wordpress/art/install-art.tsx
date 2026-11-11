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
} from "../../../steps/stage/pass-kit";
import { PinMark } from "../../../steps/stage/pin-mark";
import { useStagePlay, type PlayMode } from "../../../steps/stage/use-stage-play";
import { StageCheck, StageCursor } from "../../stage/stage-cursor";

/** wp-admin's menu, Plugins lit. */
const MENU = ["w-4/5", "w-3/5", "w-4/5", "plugins", "w-2/3", "w-3/5"] as const;

/**
 * Step one, in three beats: the zip is carried into **Upload Plugin**, a
 * progress bar fills, and the plugin's row arrives and is activated. The file
 * travels with the cursor by the same offset, so it is held, not chased.
 */
function buildPass(root: HTMLElement): AnimationSequence {
  const to = cursorTo(root);
  const drop = to('[data-art="drop"]');

  return [
    ['[data-art="row"]', { opacity: 0, y: 8 }, { duration: 0.3, at: 0 }],
    ['[data-art="active"]', { opacity: 0, scale: 0.9 }, { duration: 0.01, at: 0.3 }],
    // Held at 0 from the start of the pass, which is harmless: the bar is hidden until 1.7.
    ['[data-art="progress-fill"]', { scaleX: 0 }, { duration: 0.01, at: 0.3 }],

    // Carry the zip in.
    ['[data-art="file"]', { opacity: 1 }, { duration: 0.25, at: 0.4 }],
    ['[data-art="cursor"]', drop, { duration: 0.8, ease: EASE, at: 0.7 }],
    ['[data-art="file"]', drop, { duration: 0.8, ease: EASE, at: 0.7 }],
    ['[data-art="cursor"]', PRESS, { duration: 0.3, at: 1.5 }],
    ['[data-art="file"]', { opacity: 0, scale: 0.6 }, { duration: 0.25, at: 1.6 }],
    ['[data-art="hint"]', { opacity: 0 }, { duration: 0.2, at: 1.6 }],
    ['[data-art="file"]', { x: 0, y: 0, scale: 1 }, { duration: 0.01, at: 2.0 }],

    // Upload.
    ['[data-art="progress"]', { opacity: 1 }, { duration: 0.15, at: 1.7 }],
    ['[data-art="progress-fill"]', { scaleX: 1 }, { duration: 0.8, ease: "easeInOut", at: 1.75 }],
    ['[data-art="progress"]', { opacity: 0 }, { duration: 0.2, at: 2.6 }],
    ['[data-art="hint"]', { opacity: 1 }, { duration: 0.2, at: 2.75 }],

    // The row arrives; Activate.
    ['[data-art="row"]', { opacity: 1, y: 0 }, { duration: 0.4, ease: "backOut", at: 2.7 }],
    ['[data-art="cursor"]', to('[data-art="activate"]'), { duration: 0.6, ease: EASE, at: 2.9 }],
    ['[data-art="cursor"]', PRESS, { duration: 0.3, at: 3.55 }],
    ['[data-art="activate"]', PRESSED, { duration: 0.3, at: 3.55 }],
    ['[data-art="active"]', { opacity: 1, scale: 1 }, { duration: 0.35, ease: "backOut", at: 3.65 }],
    ['[data-art="cursor"]', HOME, { duration: 0.8, ease: EASE, at: 4.15 }],

    ...holdUntil(5.4),
  ];
}

/** wp-admin's Add Plugins screen: the dark menu, the upload zone, the plugin's row. */
export default function InstallArt({ play = "hover" }: { play?: PlayMode }) {
  const scope = useStagePlay<HTMLDivElement>(buildPass, play);

  return (
    <div ref={scope} aria-hidden="true" className="absolute inset-0 overflow-hidden">
      <TiltedWindow address="yoursite.com/wp-admin" className="inset-x-[7%] top-[7%] bottom-[12%]">
        <div className="flex min-h-0 flex-1">
          <div className="flex w-[18%] shrink-0 flex-col gap-1.5 bg-foreground/80 px-1.5 pt-2.5">
            {MENU.map((item, index) =>
              item === "plugins" ? (
                <span key={index} className="-mx-1 rounded-[3px] bg-accent px-1 py-1">
                  <span className="block h-1 w-3/4 rounded-full bg-accent-foreground/90" />
                </span>
              ) : (
                <span key={index} className={`h-1 ${item} rounded-full bg-surface/35`} />
              ),
            )}
          </div>

          <div className="flex min-w-0 flex-1 flex-col gap-2 p-3">
            <span className="text-[9px] leading-none font-semibold text-foreground">Add Plugins</span>

            <div
              data-art="drop"
              className="relative grid h-[34%] place-items-center rounded-md border border-dashed border-foreground/25 bg-foreground/[0.03]"
            >
              <span data-art="hint" className="flex flex-col items-center gap-1 text-[8px] leading-none text-muted">
                <svg viewBox="0 0 16 16" className="size-3" fill="none" aria-hidden="true">
                  <path d="M8 12V4M4.5 7.5L8 4l3.5 3.5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
                Upload Plugin
              </span>
              <span data-art="progress" className="absolute inset-x-[14%] top-1/2 h-1 -translate-y-1/2 overflow-hidden rounded-full bg-foreground/10" style={{ opacity: 0 }}>
                <span data-art="progress-fill" className="absolute inset-0 origin-left rounded-full bg-accent" />
              </span>
            </div>

            <div data-art="row" className="flex items-center gap-2 rounded-md bg-foreground/[0.04] p-2">
              <span className="mk-step-pin mk-step-pin--flat grid size-6 shrink-0 place-items-center rounded-md bg-accent/14">
                <PinMark kind="flagship" />
              </span>
              <span className="flex min-w-0 flex-1 flex-col gap-1 leading-none">
                <span className="truncate text-[9px] font-semibold text-foreground">Pinglide</span>
                <span className="h-1 w-3/5 rounded-full bg-foreground/15" />
              </span>
              <span className="relative shrink-0">
                <span
                  data-art="activate"
                  className="block rounded-full border border-foreground/40 bg-surface px-2 py-1 text-[8px] leading-none font-medium text-foreground"
                >
                  Activate
                </span>
                <span
                  data-art="active"
                  className="absolute inset-0 flex items-center justify-center gap-0.5 rounded-full bg-accent text-[8px] leading-none font-semibold text-accent-foreground"
                >
                  <StageCheck art="active-check" className="size-2" />
                  Active
                </span>
              </span>
            </div>
          </div>
        </div>
      </TiltedWindow>

      {/* The zip, held at the cursor's tip. Hidden in the finished frame. */}
      <span
        data-art="file"
        className="absolute z-20 flex h-7 w-6 -translate-x-1/2 -translate-y-full flex-col items-center justify-end rounded-[3px] border border-foreground/50 bg-surface pb-1 shadow-sm"
        style={{ left: "80%", top: "84%", opacity: 0 }}
      >
        <span className="rounded-[2px] bg-accent px-0.5 text-[6px] leading-tight font-bold text-accent-foreground">ZIP</span>
      </span>
      <StageCursor left="80%" top="84%" />
      <span data-art="hold" className="hidden" />
    </div>
  );
}
