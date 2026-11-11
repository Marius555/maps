"use client";

import type { AnimationSequence } from "motion/react";

import { HERO_PIN_COLORS } from "@/lib/marketing/hero-map";
import { BRAND } from "@/lib/brand";

import { TiltedWindow } from "../../steps/art/tilted-window";
import { WindowMap } from "../../steps/art/window-map";
import {
  centreOf,
  cursorTo,
  EASE,
  holdUntil,
  HOME,
  PRESS,
  PRESSED,
} from "../../steps/stage/pass-kit";
import { stagePlaces } from "../../steps/stage/stage-data";
import { StagePin } from "../../steps/stage/stage-pin";
import { StepStage } from "../../steps/stage/step-stage";
import { useStagePlay } from "../../steps/stage/use-stage-play";
import { StageCheck, StageCursor } from "./stage-cursor";
import { StoreHeader } from "./store-header";

/** The map in the editor; the last one is the location being added. */
const PLACES = stagePlaces(["Amsterdam", "Berlin", "Prague", "Zurich", "Milan", "Vienna"]);
const NEW = PLACES.length - 1;
const NEW_NAME = PLACES[NEW].name;

/**
 * The pass: a location is added on our side and its pin drops onto the
 * editor's map; the button is pressed and its check draws; a dot in the pin's
 * colour leaves it and lands on the owner's own site, where the same pin drops.
 * Nothing is done on the site's side — which is the thing being drawn.
 *
 * Measured at play time: the editor's pins stand on a 3D plane and the site
 * leans in its window, so where either pin is on screen is a projection.
 */
function buildPass(root: HTMLElement): AnimationSequence {
  const to = cursorTo(root);
  const from = centreOf(root, '[data-art="action"]');
  const land = centreOf(root, `[data-art="site"] [data-wpin="${NEW_NAME}"]`);
  const peak = Math.min(from.y, land.y) - 40;

  return [
    [`[data-pin="${NEW}"]`, { y: -26, opacity: 0 }, { duration: 0.3, ease: "easeIn", at: 0 }],
    [`[data-shadow="${NEW}"]`, { opacity: 0 }, { duration: 0.3, at: 0 }],
    [`[data-art="site"] [data-wpin="${NEW_NAME}"]`, { y: -6, opacity: 0 }, { duration: 0.25, at: 0 }],
    ['[data-art="action-check"]', { pathLength: 0 }, { duration: 0.01, at: 0.3 }],

    // Add a location.
    ['[data-art="cursor"]', to(`[data-anchor="${NEW}"]`), { duration: 0.7, ease: EASE, at: 0.5 }],
    ['[data-art="cursor"]', PRESS, { duration: 0.3, at: 1.25 }],
    [`[data-pin="${NEW}"]`, { y: 0, opacity: 1 }, { duration: 0.45, ease: "backOut", at: 1.35 }],
    [`[data-shadow="${NEW}"]`, { opacity: 1 }, { duration: 0.3, at: 1.45 }],
    [
      `[data-ripple="${NEW}"]`,
      // Starting at rest (invisible): a sequence holds a track's first keyframe from time zero.
      { opacity: [0, 0.7, 0], scale: [0.5, 0.5, 2.6] },
      { duration: 0.8, ease: "easeOut", times: [0, 0.02, 1], at: 1.45 },
    ],

    // Publish.
    ['[data-art="cursor"]', to('[data-art="action"]'), { duration: 0.6, ease: EASE, at: 1.95 }],
    ['[data-art="cursor"]', PRESS, { duration: 0.3, at: 2.6 }],
    ['[data-art="action"]', PRESSED, { duration: 0.3, at: 2.6 }],
    ['[data-art="action-check"]', { pathLength: 1 }, { duration: 0.35, ease: EASE, at: 2.7 }],

    // It travels; the site follows.
    ['[data-art="flyer"]', { opacity: 1 }, { duration: 0.08, at: 2.9 }],
    [
      '[data-art="flyer"]',
      { x: [from.x, land.x], y: [from.y, peak, land.y] },
      { duration: 0.7, ease: ["easeOut", "easeIn"], at: 2.9 },
    ],
    ['[data-art="flyer"]', { opacity: 0 }, { duration: 0.1, at: 3.55 }],
    [`[data-art="site"] [data-wpin="${NEW_NAME}"]`, { y: 0, opacity: 1 }, { duration: 0.45, ease: "backOut", at: 3.5 }],
    ['[data-art="cursor"]', HOME, { duration: 0.8, ease: EASE, at: 3.2 }],

    ...holdUntil(7),
  ];
}

/**
 * "Change it once, every page follows": the map in our editor on one side,
 * the owner's own site on the other, and an edit travelling from one to the
 * other with nothing done on the site. `site` draws the site as a WordPress
 * page or a Shopify storefront; `action` is the button that sends it — Publish
 * on WordPress, Redeploy inside Shopify (docs/notes/shopify.md, "The Publish
 * footer inside Shopify").
 *
 * Plays by itself while on screen, like the landing page's Sources drawing
 * (the split sections' rule); at rest every pin is standing in both places.
 */
export default function SyncScene({
  site,
  action,
}: {
  site: "wordpress" | "shopify";
  action: string;
}) {
  const scope = useStagePlay<HTMLDivElement>(buildPass, "view");

  return (
    <div ref={scope} aria-hidden="true" className="absolute inset-0 overflow-hidden">
      <StepStage place={{ left: "30%", top: "52%", width: "max(56cqw, 84cqh)" }}>
        {PLACES.map((place, index) => (
          <StagePin key={place.name} place={place} index={index} />
        ))}
      </StepStage>

      <span className="map-chrome-panel absolute top-[7%] left-[5%] z-10 flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[10px] font-medium text-foreground shadow-sm">
        <span className="size-1.5 rounded-full bg-accent" />
        {BRAND.name}
      </span>

      <span
        data-art="action"
        className="absolute bottom-[8%] left-[7%] z-10 flex h-7 items-center gap-1.5 rounded-full bg-foreground pr-1 pl-3 text-[10px] font-medium text-background shadow-lg"
      >
        {action}
        <span className="grid size-5 place-items-center rounded-full bg-accent text-accent-foreground">
          <StageCheck art="action-check" />
        </span>
      </span>

      <TiltedWindow
        address={site === "shopify" ? "yourstore.com/pages/stores" : "yoursite.com/stores"}
        className="top-[12%] right-[4%] bottom-[20%] left-[50%]"
      >
        <div className="flex min-h-0 flex-1 flex-col gap-1.5 p-2">
          {site === "shopify" ? <StoreHeader /> : null}
          <span className="h-1.5 w-2/5 rounded-full bg-foreground/50" />
          <span className="h-1 w-3/5 rounded-full bg-foreground/15" />
          <div
            data-art="site"
            className="relative mt-0.5 min-h-0 flex-1 overflow-hidden rounded-md bg-foreground/[0.04]"
          >
            <WindowMap />
          </div>
        </div>
      </TiltedWindow>

      <span
        data-art="flyer"
        className="absolute top-0 left-0 z-20 size-2.5 -translate-1/2 rounded-full ring-2 ring-surface"
        style={{ backgroundColor: HERO_PIN_COLORS[PLACES[NEW].kind], opacity: 0 }}
      />
      <StageCursor left="36%" top="78%" />
      <span data-art="hold" className="hidden" />
    </div>
  );
}
