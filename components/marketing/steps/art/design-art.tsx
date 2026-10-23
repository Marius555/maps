"use client";

import { stagger, type AnimationSequence } from "motion/react";
import { useId } from "react";

import { DotField } from "../../europe-map/dot-field";
import { PinMark } from "../stage/pin-mark";
import { STAGE_DOT, STAGE_VIEW, stagePlaces } from "../stage/stage-data";
import { StagePin } from "../stage/stage-pin";
import { StepStage } from "../stage/step-stage";
import { useHoverPlay } from "../stage/use-hover-play";
import { MiniCard } from "./mini-card";
import { CHIP_STEP, LOOKS, PIN_COLORS, StyleToolbar, SWATCH_STEP } from "./style-toolbar";

const PLACES = stagePlaces(["Amsterdam", "Paris", "Berlin", "Prague", "Zurich", "Vienna", "Milan"]);
/** The pin wearing the card: Zurich, in the middle of the ground. */
const CARD_PIN = 4;

const EASE = [0.4, 0, 0.2, 1] as const;
const PIN_STAGGER = stagger(0.05);

/** The card turns edge-on, swaps its face, and turns back. */
function flip(at: number, to: "a" | "b"): AnimationSequence {
  const from = to === "a" ? "b" : "a";
  return [
    ['[data-art="card"]', { rotateY: 90, transformPerspective: 500 }, { duration: 0.18, ease: "easeIn", at }],
    [`[data-face="${from}"]`, { opacity: 0 }, { duration: 0.01, at: at + 0.18 }],
    [`[data-face="${to}"]`, { opacity: 1 }, { duration: 0.01, at: at + 0.18 }],
    ['[data-art="card"]', { rotateY: 0, transformPerspective: 500 }, { duration: 0.28, ease: "easeOut", at: at + 0.19 }],
  ];
}

/**
 * The pass, every step a single target so it starts and ends on the drawing at
 * rest: a new basemap, then another; the pins a new colour, then another; the
 * card a new layout; then every choice walks back.
 */
const PASS: AnimationSequence = [
  ['[data-art="swatch-ring"]', { x: SWATCH_STEP }, { duration: 0.4, ease: EASE, at: 0.2 }],
  ['[data-look="1"]', { opacity: 1 }, { duration: 0.6, ease: EASE, at: 0.25 }],
  ['[data-art="swatch-ring"]', { x: SWATCH_STEP * 2 }, { duration: 0.4, ease: EASE, at: 1.2 }],
  ['[data-look="2"]', { opacity: 1 }, { duration: 0.6, ease: EASE, at: 1.25 }],
  ['[data-look="1"]', { opacity: 0 }, { duration: 0.6, ease: EASE, at: 1.25 }],

  ['[data-art="chip-ring"]', { x: CHIP_STEP }, { duration: 0.35, ease: EASE, at: 2.1 }],
  ['[data-alt="1"]', { opacity: 1 }, { duration: 0.3, delay: PIN_STAGGER, at: 2.15 }],
  ['[data-art="chip-ring"]', { x: CHIP_STEP * 2 }, { duration: 0.35, ease: EASE, at: 2.9 }],
  ['[data-alt="2"]', { opacity: 1 }, { duration: 0.3, delay: PIN_STAGGER, at: 2.95 }],
  ['[data-alt="1"]', { opacity: 0 }, { duration: 0.3, delay: PIN_STAGGER, at: 2.95 }],

  ...flip(3.75, "b"),

  ['[data-art="swatch-ring"]', { x: 0 }, { duration: 0.45, ease: EASE, at: 5 }],
  ['[data-look="2"]', { opacity: 0 }, { duration: 0.6, ease: EASE, at: 5.05 }],
  ['[data-art="chip-ring"]', { x: 0 }, { duration: 0.4, ease: EASE, at: 5.1 }],
  ['[data-alt="2"]', { opacity: 0 }, { duration: 0.3, delay: PIN_STAGGER, at: 5.15 }],
  ...flip(5.3, "a"),

  ['[data-art="hold"]', { opacity: 1 }, { duration: 0.01, at: 6.6 }],
];

const buildPass = () => PASS;

/**
 * Step two: the choices, and what they do. A designer toolbar floats over the
 * ground; on hover the basemap changes look twice, the pins change colour
 * twice, the card flips to its other layout, and everything goes back.
 *
 * The ground is drawn once, in `<defs>`, and shown through one `<use>` per
 * look, each tinted by its own `color` — three coloured copies of ~600 dots for
 * the price of one set of circles.
 */
export default function DesignArt() {
  const scope = useHoverPlay<HTMLDivElement>(buildPass);
  const dots = `mk-step-dots-${useId().replace(/[^a-zA-Z0-9_-]/g, "")}`;

  return (
    <div ref={scope} aria-hidden="true" className="absolute inset-0 overflow-hidden">
      <StepStage
        place={{ left: "56%", top: "58%", width: "max(80cqw, 112cqh)" }}
        ground={(mask) => (
          <>
            <defs>
              <g id={dots}>
                <DotField grid="europe" view={STAGE_VIEW} radius={STAGE_DOT} />
              </g>
            </defs>
            <g mask={mask}>
              <use href={`#${dots}`} className="text-foreground/30" />
              {LOOKS.slice(1).map((look, i) => (
                <g key={look.name} data-look={i + 1} style={{ opacity: 0 }}>
                  <rect width={STAGE_VIEW.width} height={STAGE_VIEW.height} fill={look.ink} opacity={0.1} />
                  <use href={`#${dots}`} style={{ color: look.ink }} opacity={0.6} />
                </g>
              ))}
            </g>
          </>
        )}
      >
        {PLACES.map((place, index) => (
          <StagePin
            key={place.name}
            place={place}
            index={index}
            above={index === CARD_PIN ? <MiniCard place={place} /> : undefined}
            marker={
              <span className="grid *:col-start-1 *:row-start-1">
                <PinMark kind={place.kind} />
                {/* Each over the last by z-index, not just by order: an icon pin's
                    shape is `z-index: 1`, and an animating opacity makes each
                    layer a stacking context that would otherwise sit under it. */}
                {PIN_COLORS.slice(1).map((color, i) => (
                  <span key={color} data-alt={i + 1} className="relative" style={{ opacity: 0, zIndex: i + 2 }}>
                    <PinMark kind={place.kind} color={color ?? undefined} />
                  </span>
                ))}
              </span>
            }
          />
        ))}
      </StepStage>

      <StyleToolbar />
      <span data-art="hold" className="hidden" />
    </div>
  );
}
