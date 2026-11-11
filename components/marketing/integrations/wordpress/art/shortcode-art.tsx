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
} from "../../../steps/stage/pass-kit";
import { useStagePlay, type PlayMode } from "../../../steps/stage/use-stage-play";
import { StageCursor } from "../../stage/stage-cursor";

/**
 * Three beats: the builder's column empties, the shortcode is carried into it,
 * and the map arrives there. The pill moves by the cursor's own offset, so it
 * is held, not chased.
 */
function buildPass(root: HTMLElement): AnimationSequence {
  const to = cursorTo(root);
  const slot = to('[data-art="slot"]', { x: -24 });

  return [
    ['[data-art="map-layer"]', { opacity: 0 }, { duration: 0.35, at: 0.15 }],
    ...clearMap(0.5),

    // Pick up the shortcode and carry it over. `scale` is held at 0.9 from the
    // start of the pass, harmless: the pill is hidden until 0.55.
    ['[data-art="pill"]', { opacity: 1, scale: [0.9, 1] }, { duration: 0.25, at: 0.55 }],
    ['[data-art="cursor"]', PRESS, { duration: 0.3, at: 0.75 }],
    ['[data-art="cursor"]', slot, { duration: 0.9, ease: EASE, at: 1.0 }],
    ['[data-art="pill"]', slot, { duration: 0.9, ease: EASE, at: 1.0 }],
    ['[data-art="target"]', { opacity: 1 }, { duration: 0.2, at: 1.6 }],

    // Drop it; the map arrives.
    ['[data-art="cursor"]', PRESS, { duration: 0.3, at: 1.95 }],
    ['[data-art="pill"]', { opacity: 0, scale: 0.8 }, { duration: 0.25, at: 2.05 }],
    ['[data-art="target"]', { opacity: 0 }, { duration: 0.25, at: 2.1 }],
    ['[data-art="map-layer"]', { opacity: 1 }, { duration: 0.2, at: 2.2 }],
    ...arriveMap(2.25),
    ['[data-art="pill"]', { x: 0, y: 0, scale: 1 }, { duration: 0.01, at: 2.4 }],
    ['[data-art="cursor"]', HOME, { duration: 0.8, ease: EASE, at: 2.6 }],

    ...holdUntil(5.4),
  ];
}

/** A page builder's two columns: text in one, the map dropped into the other. */
export default function ShortcodeArt({ play = "hover" }: { play?: PlayMode }) {
  const scope = useStagePlay<HTMLDivElement>(buildPass, play);

  return (
    <div ref={scope} aria-hidden="true" className="absolute inset-0 overflow-hidden">
      <TiltedWindow address="yoursite.com/wp-admin" className="inset-x-[7%] top-[7%] bottom-[22%]">
        <div className="flex min-h-0 flex-1 gap-2.5 p-2.5">
          <div className="flex w-[36%] shrink-0 flex-col gap-1.5 pt-1">
            <span className="h-2 w-4/5 rounded-full bg-foreground/50" />
            <span className="h-1 w-full rounded-full bg-foreground/15" />
            <span className="h-1 w-11/12 rounded-full bg-foreground/15" />
            <span className="h-1 w-3/4 rounded-full bg-foreground/15" />
            <span className="mt-1 min-h-0 flex-1 rounded-md bg-foreground/[0.06]" />
          </div>

          <div
            data-art="slot"
            className="relative min-w-0 flex-1 rounded-md border border-dashed border-foreground/25 bg-foreground/[0.03]"
          >
            <span
              data-art="target"
              className="absolute inset-0 rounded-md bg-accent/10 ring-[1.5px] ring-accent"
              style={{ opacity: 0 }}
            />
            <div data-art="map-layer" className="absolute -inset-px overflow-hidden rounded-md bg-surface">
              <div className="absolute inset-0 bg-foreground/[0.04]">
                <WindowMap />
              </div>
            </div>
          </div>
        </div>
      </TiltedWindow>

      {/* The shortcode, as Settings → Pinglide hands it out. Hidden in the finished frame. */}
      <span
        data-art="pill"
        className="absolute bottom-[7%] left-[9%] z-20 rounded-full bg-foreground px-2.5 py-1.5 font-mono text-[9px] leading-none whitespace-nowrap text-background shadow-lg"
        style={{ opacity: 0 }}
      >
        [pinglide slot=&quot;…&quot;]
      </span>
      <StageCursor left="18%" top="88%" />
      <span data-art="hold" className="hidden" />
    </div>
  );
}
