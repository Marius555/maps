"use client";

import { stagger, type AnimationSequence } from "motion/react";

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
import { StageCursor } from "../../stage/stage-cursor";

const MAPS = [
  { name: "Our shops", count: "48 locations" },
  { name: "Stockists", count: "212 locations" },
  { name: "Pop-up events", count: "9 locations" },
] as const;

/**
 * Step one, in two beats: **Install** is pressed on the app's listing, and the
 * app opens inside the store's admin with the maps list — no signup, because
 * the store is its own workspace (docs/notes/shopify.md, "Accounts").
 */
function buildPass(root: HTMLElement): AnimationSequence {
  const to = cursorTo(root);

  return [
    ['[data-art="admin"]', { opacity: 0 }, { duration: 0.3, at: 0 }],
    ["[data-map-row]", { opacity: 0, y: 6 }, { duration: 0.01, at: 0.3 }],

    ['[data-art="cursor"]', to('[data-art="install"]'), { duration: 0.7, ease: EASE, at: 0.5 }],
    ['[data-art="cursor"]', PRESS, { duration: 0.3, at: 1.25 }],
    ['[data-art="install"]', PRESSED, { duration: 0.3, at: 1.25 }],

    ['[data-art="admin"]', { opacity: 1, y: [8, 0] }, { duration: 0.4, ease: EASE, at: 1.7 }],
    ["[data-map-row]", { opacity: 1, y: 0 }, { duration: 0.35, ease: "backOut", delay: stagger(0.09), at: 2.15 }],
    ['[data-art="cursor"]', HOME, { duration: 0.8, ease: EASE, at: 2.0 }],

    ...holdUntil(5),
  ];
}

/** The app's listing, then the app open in the admin. At rest it is installed and open. */
export default function InstallAppArt({ play = "hover" }: { play?: PlayMode }) {
  const scope = useStagePlay<HTMLDivElement>(buildPass, play);

  return (
    <div ref={scope} aria-hidden="true" className="absolute inset-0 overflow-hidden">
      <TiltedWindow address="Shopify App Store" className="inset-x-[7%] top-[7%] bottom-[12%]">
        {/* The listing. */}
        <div className="flex min-h-0 flex-1 flex-col gap-2 p-3">
          <div className="flex items-center gap-2">
            <span className="mk-step-pin mk-step-pin--flat grid size-8 shrink-0 place-items-center rounded-lg bg-accent/14">
              <PinMark kind="flagship" />
            </span>
            <span className="flex min-w-0 flex-col gap-1 leading-none">
              <span className="truncate text-[10px] font-semibold text-foreground">Pinglide</span>
              <span className="h-1 w-20 rounded-full bg-foreground/15" />
            </span>
            <span
              data-art="install"
              className="ml-auto rounded-full bg-foreground px-2.5 py-1 text-[8px] leading-none font-semibold text-background"
            >
              Install
            </span>
          </div>
          <span className="min-h-0 flex-1 rounded-md bg-foreground/[0.05]" />
          <span className="h-1 w-4/5 rounded-full bg-foreground/15" />
          <span className="h-1 w-3/5 rounded-full bg-foreground/15" />
        </div>

        {/* The admin, with the app open in it. */}
        <div data-art="admin" className="absolute inset-0 z-10 flex bg-surface">
          <div className="flex w-[24%] shrink-0 flex-col gap-1.5 bg-foreground/[0.05] px-2 pt-2.5">
            <span className="h-1 w-4/5 rounded-full bg-foreground/20" />
            <span className="h-1 w-3/5 rounded-full bg-foreground/20" />
            <span className="h-1 w-2/3 rounded-full bg-foreground/20" />
            <span className="mt-1 text-[6.5px] leading-none font-semibold tracking-wide text-muted uppercase">Apps</span>
            <span className="-mx-1 flex items-center gap-1 rounded-[3px] bg-surface px-1 py-1 text-[7.5px] leading-none font-medium text-foreground shadow-sm">
              <span className="size-1.5 rounded-full bg-accent" />
              Pinglide
            </span>
          </div>

          <div className="flex min-w-0 flex-1 flex-col gap-1.5 p-2.5">
            <div className="flex items-center">
              <span className="text-[9px] leading-none font-semibold text-foreground">Maps</span>
              <span className="ml-auto rounded-full bg-accent px-2 py-1 text-[7px] leading-none font-semibold text-accent-foreground">
                New map
              </span>
            </div>
            {MAPS.map((map) => (
              <span key={map.name} data-map-row="" className="flex items-center gap-1.5 rounded-md border border-border px-1.5 py-1.5">
                <span className="size-3 shrink-0 rounded-[3px] bg-foreground/10" />
                <span className="flex min-w-0 flex-col gap-0.5 leading-none">
                  <span className="truncate text-[8px] font-medium text-foreground">{map.name}</span>
                  <span className="truncate text-[7px] text-muted">{map.count}</span>
                </span>
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
