"use client";

import type { AnimationSequence, Segment } from "motion/react";

import { HERO_PIN_COLORS } from "@/lib/marketing/hero-map";

import { DotField } from "../europe-map/dot-field";
import { STAGE_DOT, STAGE_VIEW, stagePlaces } from "../steps/stage/stage-data";
import { StagePin } from "../steps/stage/stage-pin";
import { StepStage } from "../steps/stage/step-stage";
import { useViewPlay } from "../steps/stage/use-view-play";
import { NetworkCard, REQUESTS } from "./network-card";

/** The customer's map: the west of the stage, clear of the card on the right. */
const PLACES = stagePlaces(["Amsterdam", "Paris", "Berlin", "Zurich", "Milan"]);
/** Where the script and the tiles land: Zurich, in the middle of the ground. */
const TARGET = 3;
const TARGET_PLACE = PLACES[TARGET];

/** The request that carries the locations: its dots become the pins. */
const MAP_FILE = 1;

/**
 * One dot per flight. The map's own file sends one per location, each in its
 * pin's colour and landing on that pin's spot; the script and the tiles send
 * one each, onto the middle of the ground.
 */
const FLIGHTS: readonly { request: number; pin?: number }[] = REQUESTS.flatMap((_, request) =>
  request === MAP_FILE ? PLACES.map((__, pin) => ({ request, pin })) : [{ request }],
);

const EASE = [0.4, 0, 0.2, 1] as const;
const FADE_S = 0.35;
const FIRST_S = 0.7;
const FLIGHT_S = 0.55;
/** Between one dot of the map file leaving its row and the next. */
const PIN_GAP_S = 0.12;
/** Between one request's last landing and the next request lighting. */
const NEXT_S = 0.45;

/**
 * The pass: the map fades out and resets while nothing shows. Then each file
 * arrives in turn: its row lights, dots leave the row and arc down onto the
 * map, the row is ticked once its last dot lands, and **the map changes where
 * each dot lands** — the script's wakes the ground in a ring from its spot, the
 * map file's dots each drop their own pin, the tiles wash out from theirs. Last,
 * the line through Google's row draws: the request that is not in the list.
 *
 * One dot landing on Zurich while five pins dropped elsewhere read as the
 * network panel and the map playing independently (owner, 2026-10-24) — so a
 * dot always lands on what it changes, as in the import drawing.
 *
 * **Forward only, never rewound.** The reset used to undo the build — pins
 * rising off the map, ticks un-drawing, the strike retracting — which read as
 * the animation playing backward (owner, 2026-10-23). Now everything fades out
 * in place, and only then, invisible, is put back to its start. The data flows
 * one way too: files travel from the network panel *to* the map, the way a
 * download does.
 *
 * Starts and ends on the drawing at rest (usePassPlay's rule), and is measured
 * at play time: the pins stand on a 3D plane, so where each is on screen is a
 * perspective projection that moves with every column width.
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
    // Fade out in place…
    ['[data-art="ground"]', { opacity: 0.25 }, { duration: FADE_S, at: 0 }],
    ["[data-pin]", { opacity: 0 }, { duration: FADE_S, at: 0 }],
    ["[data-shadow]", { opacity: 0 }, { duration: FADE_S, at: 0 }],
    ["[data-check]", { opacity: 0 }, { duration: FADE_S, at: 0 }],
    ['[data-art="strike"]', { opacity: 0 }, { duration: FADE_S, at: 0 }],
    // …then, unseen, back to where each one starts.
    ["[data-pin]", { y: -26 }, { duration: 0.01, at: FADE_S }],
    ["[data-check]", { pathLength: 0 }, { duration: 0.01, at: FADE_S }],
    ['[data-art="strike"]', { scaleX: 0 }, { duration: 0.01, at: FADE_S }],
  ];

  let at = FIRST_S;
  let lastLand = at;

  REQUESTS.forEach((_, index) => {
    const row = centre(`[data-req-target="${index}"]`);
    let land = at;
    let sent = 0;

    FLIGHTS.forEach((flight, flyer) => {
      if (flight.request !== index) return;
      const leave = at + sent++ * PIN_GAP_S;
      const to = centre(`[data-anchor="${flight.pin ?? TARGET}"]`);
      const peak = Math.min(row.y, to.y) - 30;
      land = leave + FLIGHT_S;

      sequence.push(
        [`[data-flyer="${flyer}"]`, { opacity: 1 }, { duration: 0.08, at: leave }],
        [
          `[data-flyer="${flyer}"]`,
          { x: [row.x, to.x], y: [row.y, peak, to.y] },
          { duration: FLIGHT_S, ease: ["easeOut", "easeIn"], at: leave },
        ],
        [`[data-flyer="${flyer}"]`, { opacity: 0 }, { duration: 0.1, at: land - 0.05 }],
        ...arrival(flight, land),
      );
    });

    sequence.push(
      [`[data-req-hl="${index}"]`, { opacity: 1 }, { duration: 0.15, at }],
      [`[data-check="${index}"]`, { opacity: 1 }, { duration: 0.01, at: land }],
      [`[data-check="${index}"]`, { pathLength: 1 }, { duration: 0.3, ease: EASE, at: land }],
      [`[data-req-hl="${index}"]`, { opacity: 0 }, { duration: 0.3, at: land + 0.25 }],
    );

    lastLand = land;
    at = land + NEXT_S;
  });

  const strike = lastLand + 0.6;
  sequence.push(
    ['[data-art="strike"]', { opacity: 1 }, { duration: 0.01, at: strike }],
    ['[data-art="strike"]', { scaleX: 1 }, { duration: 0.45, ease: EASE, at: strike }],
    ['[data-art="never"]', { scale: [1, 1.2, 1] }, { duration: 0.35, at: strike + 0.3 }],
    // A beat of the loaded map before the next pass empties it again.
    ['[data-art="hold"]', { opacity: 1 }, { duration: 0.01, at: strike + 1.9 }],
  );
  return sequence;
}

/** What one dot changes on the map, on the spot where it lands. */
function arrival({ request, pin }: (typeof FLIGHTS)[number], land: number): Segment[] {
  if (pin !== undefined) {
    return [
      [`[data-pin="${pin}"]`, { y: 0, opacity: 1 }, { duration: 0.45, ease: "backOut", at: land - 0.1 }],
      [`[data-shadow="${pin}"]`, { opacity: 1 }, { duration: 0.3, at: land }],
      [
        `[data-ripple="${pin}"]`,
        // Starting at rest (invisible): a sequence holds a track's first keyframe from time zero.
        { opacity: [0, 0.7, 0], scale: [0.5, 0.5, 2.6] },
        { duration: 0.8, ease: "easeOut", times: [0, 0.02, 1], at: land },
      ],
    ];
  }

  if (request === 0) {
    return [
      ['[data-art="ground"]', { opacity: 1 }, { duration: 0.6, ease: EASE, at: land }],
      [
        '[data-art="ring"]',
        // At rest the ring is a zero-radius, invisible circle.
        { r: [0, 20, 260], opacity: [0, 0.6, 0] },
        { duration: 1, ease: "easeOut", times: [0, 0.1, 1], at: land },
      ],
    ];
  }

  return [
    [
      '[data-art="wash"]',
      // At rest the wash is a zero-radius, invisible circle.
      { r: [0, 30, 300], opacity: [0, 0.4, 0] },
      { duration: 1.1, ease: "easeOut", times: [0, 0.15, 1], at: land },
    ],
  ];
}

/**
 * A published map loading on a customer's page: the editor's pins standing on
 * the steps' dotted Europe, and beside it the page's network panel — three
 * requests to our CDN and the open tile host, ticked, and Google's, struck
 * through because it never happens. Plays by itself while on screen.
 */
export default function NoGoogleArt() {
  const scope = useViewPlay<HTMLDivElement>(buildPass);

  return (
    <div ref={scope} aria-hidden="true" className="absolute inset-0 overflow-hidden">
      <StepStage
        place={{ left: "40%", top: "58%", width: "max(64cqw, 96cqh)" }}
        ground={(mask) => (
          <g mask={mask}>
            <g data-art="ground">
              <DotField grid="europe" view={STAGE_VIEW} radius={STAGE_DOT} className="text-foreground/30" />
            </g>
            <circle
              data-art="ring"
              cx={TARGET_PLACE.x}
              cy={TARGET_PLACE.y}
              r={0}
              fill="none"
              stroke="var(--accent)"
              strokeWidth={4}
              opacity={0}
            />
            <circle
              data-art="wash"
              cx={TARGET_PLACE.x}
              cy={TARGET_PLACE.y}
              r={0}
              fill="var(--accent)"
              opacity={0}
            />
          </g>
        )}
      >
        {PLACES.map((place, index) => (
          <StagePin key={place.name} place={place} index={index} />
        ))}
      </StepStage>

      <NetworkCard />

      {FLIGHTS.map((flight, index) => (
        <span
          key={index}
          data-flyer={index}
          className="absolute top-0 left-0 z-20 size-2.5 -translate-1/2 rounded-full bg-accent ring-2 ring-surface"
          style={{
            backgroundColor: flight.pin === undefined ? undefined : HERO_PIN_COLORS[PLACES[flight.pin].kind],
            opacity: 0,
          }}
        />
      ))}
      <span data-art="hold" className="hidden" />
    </div>
  );
}
