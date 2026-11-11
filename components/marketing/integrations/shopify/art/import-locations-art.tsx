"use client";

import { stagger, type AnimationSequence } from "motion/react";

import { HERO_PIN_COLORS } from "@/lib/marketing/hero-map";

import { centreOf, cursorTo, EASE, holdUntil, HOME, PRESS, PRESSED } from "../../../steps/stage/pass-kit";
import { stagePlace } from "../../../steps/stage/stage-data";
import { StagePin } from "../../../steps/stage/stage-pin";
import { StepStage } from "../../../steps/stage/step-stage";
import { useStagePlay, type PlayMode } from "../../../steps/stage/use-stage-play";
import { StageCursor } from "../../stage/stage-cursor";

/** The store's locations, as Shopify lists them. */
const ROWS = [
  { name: "Flagship store", place: stagePlace("Berlin") },
  { name: "Old Town", place: stagePlace("Prague") },
  { name: "Mariahilf", place: stagePlace("Vienna") },
  { name: "Navigli", place: stagePlace("Milan") },
  { name: "Altstadt", place: stagePlace("Zurich") },
] as const;

const FIRST_FLIGHT_S = 1.75;
const ROW_STEP_S = 0.42;
const FLIGHT_S = 0.55;

/**
 * The pass: the pins lift off the map; **Import from Shopify** is pressed and
 * the store's locations come in; then row after row lights, a dot leaves it
 * and arcs across, and the row's pin drops where Shopify already said it is —
 * which is why an import from Shopify spends no lookups (docs/notes/shopify.md,
 * "Import from Shopify"). The landing page's import drawing, with Shopify as
 * the spreadsheet.
 *
 * Measured at play time: the pins stand on a 3D plane, so where one is on
 * screen is a perspective projection.
 */
function buildPass(root: HTMLElement): AnimationSequence {
  const to = cursorTo(root);

  const sequence: AnimationSequence = [
    ["[data-pin]", { y: -26, opacity: 0 }, { duration: 0.3, ease: "easeIn", at: 0 }],
    ["[data-shadow]", { opacity: 0 }, { duration: 0.3, at: 0 }],
    ["[data-loc-row]", { opacity: 0 }, { duration: 0.25, at: 0 }],

    ['[data-art="cursor"]', to('[data-art="import"]'), { duration: 0.6, ease: EASE, at: 0.35 }],
    ['[data-art="cursor"]', PRESS, { duration: 0.3, at: 1.0 }],
    ['[data-art="import"]', PRESSED, { duration: 0.3, at: 1.0 }],
    ["[data-loc-row]", { opacity: 1 }, { duration: 0.25, delay: stagger(0.06), at: 1.2 }],
    ['[data-art="cursor"]', HOME, { duration: 0.8, ease: EASE, at: 1.35 }],
  ];

  ROWS.forEach((_, index) => {
    const at = FIRST_FLIGHT_S + index * ROW_STEP_S;
    const land = at + FLIGHT_S;
    const from = centreOf(root, `[data-row-dot="${index}"]`);
    const end = centreOf(root, `[data-anchor="${index}"]`);
    const peak = Math.min(from.y, end.y) - 34;

    sequence.push(
      [`[data-row-hl="${index}"]`, { opacity: 1 }, { duration: 0.15, at }],
      [`[data-flyer="${index}"]`, { opacity: 1 }, { duration: 0.08, at }],
      [
        `[data-flyer="${index}"]`,
        { x: [from.x, end.x], y: [from.y, peak, end.y] },
        { duration: FLIGHT_S, ease: ["easeOut", "easeIn"], at },
      ],
      [`[data-flyer="${index}"]`, { opacity: 0 }, { duration: 0.1, at: land - 0.05 }],
      [`[data-pin="${index}"]`, { y: 0, opacity: 1 }, { duration: 0.45, ease: "backOut", at: land - 0.1 }],
      [`[data-shadow="${index}"]`, { opacity: 1 }, { duration: 0.3, at: land }],
      [
        `[data-ripple="${index}"]`,
        // Starting at rest (invisible): a sequence holds a track's first keyframe from time zero.
        { opacity: [0, 0.7, 0], scale: [0.5, 0.5, 2.6] },
        { duration: 0.8, ease: "easeOut", times: [0, 0.02, 1], at: land },
      ],
      [`[data-row-hl="${index}"]`, { opacity: 0 }, { duration: 0.3, at: land + 0.1 }],
    );
  });

  sequence.push(...holdUntil(FIRST_FLIGHT_S + ROWS.length * ROW_STEP_S + 2.2));
  return sequence;
}

/**
 * Step two: the store's own locations beside the map, and on hover each one
 * followed across to the pin it becomes. At rest they are all on the map.
 */
export default function ImportLocationsArt({ play = "hover" }: { play?: PlayMode }) {
  const scope = useStagePlay<HTMLDivElement>(buildPass, play);

  return (
    <div ref={scope} aria-hidden="true" className="absolute inset-0 overflow-hidden">
      <StepStage place={{ left: "66%", top: "54%", width: "max(70cqw, 104cqh)" }}>
        {ROWS.map((row, index) => (
          <StagePin key={row.name} place={row.place} index={index} />
        ))}
      </StepStage>

      <div className="absolute top-1/2 left-[5%] z-10 w-[42%] -translate-y-1/2 overflow-hidden rounded-xl border border-border bg-surface text-[10px] leading-none shadow-md">
        <div className="flex items-center bg-foreground/[0.04] px-2.5 py-1.5">
          <span
            data-art="import"
            className="rounded-full bg-foreground px-2 py-1 text-[8px] font-semibold whitespace-nowrap text-background"
          >
            Import from Shopify
          </span>
        </div>

        {ROWS.map((row, index) => (
          <div
            key={row.name}
            data-loc-row=""
            className="relative grid grid-cols-[1fr_auto] items-center gap-2 border-t border-border px-2.5 py-[7px]"
          >
            <span data-row-hl={index} aria-hidden="true" className="absolute inset-0 bg-accent/12" style={{ opacity: 0 }} />
            <span className="relative flex min-w-0 items-center gap-2">
              <span
                data-row-dot={index}
                className="size-2 shrink-0 rounded-full"
                style={{ backgroundColor: HERO_PIN_COLORS[row.place.kind] }}
              />
              <span className="truncate font-medium text-foreground">{row.name}</span>
            </span>
            <span className="relative text-muted">{row.place.name}</span>
          </div>
        ))}
      </div>

      {ROWS.map((row, index) => (
        <span
          key={row.name}
          data-flyer={index}
          className="absolute top-0 left-0 z-20 size-2.5 -translate-1/2 rounded-full ring-2 ring-surface"
          style={{ backgroundColor: HERO_PIN_COLORS[row.place.kind], opacity: 0 }}
        />
      ))}
      <StageCursor left="40%" top="86%" />
      <span data-art="hold" className="hidden" />
    </div>
  );
}
