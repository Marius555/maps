"use client";

import type { AnimationSequence } from "motion/react";

import { HERO_PIN_COLORS } from "@/lib/marketing/hero-map";

import { stagePlace } from "../stage/stage-data";
import { StagePin } from "../stage/stage-pin";
import { StepStage } from "../stage/step-stage";
import { useHoverPlay } from "../stage/use-hover-play";
import { SheetCard, type SheetRow } from "./sheet-card";

const ROWS: readonly SheetRow[] = [
  { shop: "Kreuzberg", place: stagePlace("Berlin") },
  { shop: "Staré Město", place: stagePlace("Prague") },
  { shop: "Neubau", place: stagePlace("Vienna") },
  { shop: "Brera", place: stagePlace("Milan") },
  { shop: "Trastevere", place: stagePlace("Rome") },
];

const FIRST_ROW_S = 0.55;
const ROW_STEP_S = 0.5;
const FLIGHT_S = 0.55;
/** A beat of the finished map before the next pass lifts the pins again. */
const PASS_S = 5;

/**
 * The pass: the pins lift off the map, then row after row lights, a dot leaves
 * it and arcs across, and the row's pin drops onto the spot with a ripple.
 *
 * Measured at play time, not computed: the pins stand on a 3D plane, so where
 * one is on screen is a perspective projection inside a panel whose width
 * changes at every breakpoint. Its zero-size anchor's box is that projection.
 */
function buildPass(root: HTMLElement): AnimationSequence {
  const box = root.getBoundingClientRect();
  const centre = (selector: string) => {
    const r = root.querySelector(selector)?.getBoundingClientRect();
    return r
      ? { x: r.left + r.width / 2 - box.left, y: r.top + r.height / 2 - box.top }
      : { x: 0, y: 0 };
  };

  const sequence: AnimationSequence = [
    ["[data-pin]", { y: -26, opacity: 0 }, { duration: 0.3, ease: "easeIn", at: 0 }],
    ["[data-shadow]", { opacity: 0 }, { duration: 0.3, at: 0 }],
  ];

  ROWS.forEach((_, index) => {
    const at = FIRST_ROW_S + index * ROW_STEP_S;
    const land = at + FLIGHT_S;
    const from = centre(`[data-row-dot="${index}"]`);
    const to = centre(`[data-anchor="${index}"]`);
    const peak = Math.min(from.y, to.y) - 34;

    sequence.push(
      [`[data-row-hl="${index}"]`, { opacity: 1 }, { duration: 0.15, at }],
      [`[data-flyer="${index}"]`, { opacity: 1 }, { duration: 0.08, at }],
      [
        `[data-flyer="${index}"]`,
        { x: [from.x, to.x], y: [from.y, peak, to.y] },
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

  sequence.push(['[data-art="hold"]', { opacity: 1 }, { duration: 0.01, at: PASS_S }]);
  return sequence;
}

/**
 * Step one: a spreadsheet beside the map, and on hover each row followed
 * across to the pin it becomes. At rest the import has already happened —
 * every pin is standing — which is also the whole picture under reduced motion.
 */
export default function ImportArt() {
  const scope = useHoverPlay<HTMLDivElement>(buildPass);

  return (
    <div ref={scope} aria-hidden="true" className="absolute inset-0 overflow-hidden">
      <StepStage place={{ left: "66%", top: "54%", width: "max(70cqw, 104cqh)" }}>
        {ROWS.map((row, index) => (
          <StagePin key={row.shop} place={row.place} index={index} />
        ))}
      </StepStage>

      <SheetCard rows={ROWS} />

      {ROWS.map((row, index) => (
        <span
          key={row.shop}
          data-flyer={index}
          className="absolute top-0 left-0 z-20 size-2.5 -translate-1/2 rounded-full ring-2 ring-surface"
          style={{ backgroundColor: HERO_PIN_COLORS[row.place.kind], opacity: 0 }}
        />
      ))}
      <span data-art="hold" className="hidden" />
    </div>
  );
}
