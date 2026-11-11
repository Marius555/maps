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
import { PinGlyph, StageCursor } from "../../stage/stage-cursor";
import { StoreHeader } from "../../stage/store-header";

/**
 * The pass, after a beat on the finished store: the block leaves the template
 * and the map leaves the page; **Add block** is pressed, the Apps list opens and
 * **Pinglide map** is chosen; the block joins the template and the map arrives
 * in the preview, the way it does on the landing page. No map is picked — the
 * first map shown on the storefront is the default, so a new block needs no
 * settings (docs/notes/shopify.md, "Storefront").
 */
function buildPass(root: HTMLElement): AnimationSequence {
  const to = cursorTo(root);

  return [
    ['[data-art="block-row"]', { opacity: 0, x: -6 }, { duration: 0.3, at: 0.6 }],
    ['[data-art="map-layer"]', { opacity: 0 }, { duration: 0.35, at: 0.6 }],
    ...clearMap(1.0),

    // Add block → Apps → Pinglide map.
    ['[data-art="cursor"]', to('[data-art="add-block"]'), { duration: 0.75, ease: EASE, at: 1.1 }],
    ['[data-art="cursor"]', PRESS, { duration: 0.3, at: 1.9 }],
    ['[data-art="add-block"]', PRESSED, { duration: 0.3, at: 1.9 }],
    ['[data-art="apps"]', { opacity: 1, y: [-6, 0] }, { duration: 0.3, ease: EASE, at: 2.05 }],
    ['[data-art="cursor"]', to('[data-art="app-item"]'), { duration: 0.5, ease: EASE, at: 2.4 }],
    ['[data-art="app-hl"]', { opacity: 1 }, { duration: 0.2, at: 2.8 }],
    ['[data-art="cursor"]', PRESS, { duration: 0.3, at: 3.0 }],
    ['[data-art="apps"]', { opacity: 0, y: -6 }, { duration: 0.25, at: 3.25 }],
    ['[data-art="app-hl"]', { opacity: 0 }, { duration: 0.01, at: 3.6 }],

    // The block is in the template; the map is on the page.
    ['[data-art="block-row"]', { opacity: 1, x: 0 }, { duration: 0.4, ease: "backOut", at: 3.3 }],
    ['[data-art="map-layer"]', { opacity: 1 }, { duration: 0.2, at: 3.45 }],
    ...arriveMap(3.5),
    ['[data-art="cursor"]', HOME, { duration: 0.8, ease: EASE, at: 3.9 }],

    ...holdUntil(8),
  ];
}

const SECTIONS = ["Image banner", "Featured collection"] as const;

/**
 * /for/shopify's lead drawing: the theme editor, the template's sections down
 * the left and the store's preview beside them, with the Pinglide map block
 * added and the map on the page. Plays by itself while on screen.
 */
export default function ThemeEditorArt({ play = "view" }: { play?: PlayMode }) {
  const scope = useStagePlay<HTMLDivElement>(buildPass, play);

  return (
    <div ref={scope} aria-hidden="true" className="absolute inset-0 overflow-hidden">
      <TiltedWindow
        className="inset-x-[5%] top-[6%] bottom-[10%]"
        bar={
          <>
            <span className="size-1.5 rounded-full bg-foreground/20" />
            <span className="size-1.5 rounded-full bg-foreground/20" />
            <span className="size-1.5 rounded-full bg-foreground/20" />
            <span className="ml-2 rounded-full bg-foreground/[0.06] px-2 py-px text-[8px] text-muted">Home page</span>
            <span className="ml-auto rounded-[3px] bg-foreground px-1.5 py-[3px] text-[6.5px] leading-none font-semibold text-background">
              Save
            </span>
          </>
        }
      >
        <div className="flex min-h-0 flex-1">
          {/* The template's sections, and the block once added. */}
          <div className="flex w-[33%] shrink-0 flex-col gap-1 border-r border-border p-2 text-[7.5px] leading-none">
            <span className="px-1 pb-0.5 text-[6.5px] font-semibold tracking-wide text-muted uppercase">Template</span>
            {SECTIONS.map((name) => (
              <span key={name} className="flex items-center gap-1.5 rounded px-1 py-1 text-foreground">
                <span className="size-1.5 rounded-[2px] bg-foreground/30" />
                <span className="truncate">{name}</span>
              </span>
            ))}
            <span
              data-art="block-row"
              className="flex items-center gap-1.5 rounded bg-accent/12 px-1 py-1 font-medium text-foreground"
            >
              <PinGlyph className="size-1.5" />
              <span className="truncate">Pinglide map</span>
            </span>
            <span data-art="add-block" className="flex w-fit items-center gap-1 rounded px-1 py-1 font-medium text-accent">
              <span className="text-[9px] leading-none">+</span>
              Add block
            </span>
          </div>

          {/* The store, as the editor previews it. */}
          <div className="flex min-w-0 flex-1 flex-col gap-1.5 p-2">
            <StoreHeader />
            <span className="h-[20%] shrink-0 rounded-md bg-foreground/[0.06]" />
            <span className="h-1.5 w-2/5 shrink-0 rounded-full bg-foreground/50" />
            <div className="relative min-h-0 flex-1 overflow-hidden rounded-md bg-foreground/[0.04]">
              <div data-art="map-layer" className="absolute inset-0">
                <WindowMap places={["Amsterdam", "Paris", "Berlin", "Zurich", "Vienna", "Milan", "Prague"]} />
              </div>
            </div>
          </div>
        </div>

        {/* The Apps list Add block opens. Hidden in the finished frame. */}
        <div
          data-art="apps"
          className="absolute top-[54%] left-[24%] z-10 w-[40%] rounded-lg border border-border bg-surface p-1.5 shadow-lg"
          style={{ opacity: 0 }}
        >
          <span className="block rounded-md bg-foreground/[0.05] px-1.5 py-1">
            <span className="block h-1 w-1/2 rounded-full bg-foreground/20" />
          </span>
          <span className="mt-1.5 block px-1 text-[6.5px] leading-none font-semibold tracking-wide text-muted uppercase">
            Apps
          </span>
          <span
            data-art="app-item"
            className="relative mt-1 flex items-center gap-1.5 rounded-md px-1.5 py-1 text-[8px] leading-none font-medium text-foreground"
          >
            <span data-art="app-hl" className="absolute inset-0 rounded-md bg-accent/14" style={{ opacity: 0 }} />
            <PinGlyph className="relative" />
            <span className="relative">Pinglide map</span>
          </span>
        </div>
      </TiltedWindow>

      <StageCursor left="82%" top="82%" />
      <span data-art="hold" className="hidden" />
    </div>
  );
}
