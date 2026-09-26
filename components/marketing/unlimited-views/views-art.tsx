"use client";

import type { AnimationSequence, Segment } from "motion/react";

import { PRODUCT_NAME } from "@/lib/config";
import { METERED_USD_PER_1000 } from "@/lib/marketing/cost";
import { MARKETING_PLANS } from "@/lib/marketing/plans";

import { ART_PIN, ART_RAISED } from "../art/art-pin";
import { useArtLoop } from "../steps/art/use-art-loop";

const W = 360;
const H = 240;

const LANE = { x: 12, width: 336, height: 100 } as const;
const LANE_TOPS = { metered: 14, flat: 126 } as const;

const VISITOR_X = 36;
/** Heads of the three visitors, relative to the lane's top. */
const VISITOR_YS = [42, 62, 82] as const;

const BOX = { x: 118, width: 80, top: 34, height: 44 } as const;
const METER = { x: 220, width: 114, top: 50, height: 10 } as const;

/** Where the metered bar rests (the server's frame) and where each loop starts it. */
const METERED_EMPTY = 8;
/** The flat bar never moves: a month's price is the same share of the track at any traffic. */
const FLAT_WIDTH = 24;

const STARTER_PRICE =
  MARKETING_PLANS.find((plan) => plan.id === "starter")?.price ?? "€19";

const EASE = [0.4, 0, 0.2, 1] as const;
const TRAVEL_S = 0.5;
const START_S = 0.5;

/** Each metered visitor's request, one after another, each one adding to the bill. */
const METERED_STEP_S = 0.6;

/** Twice as many visitors on the flat lane, closer together — and nothing adds up. */
const FLAT_REQUESTS = [0, 1, 2, 0, 1, 2] as const;
const FLAT_STEP_S = 0.3;

const boxMid = (laneTop: number) => laneTop + BOX.top + BOX.height / 2;

/** A request's trip, as the offset from its visitor to the box. */
function trip(laneTop: number, visitor: number) {
  return {
    x: BOX.x - (VISITOR_X + 12),
    y: boxMid(laneTop) - (laneTop + VISITOR_YS[visitor] + 2),
  };
}

const travel = (
  selector: string,
  laneTop: number,
  visitor: number,
  at: number,
): Segment => {
  const { x, y } = trip(laneTop, visitor);

  // Every list starts at the dot's resting value — invisible, at its visitor —
  // because a sequence holds a track's first keyframe from time zero.
  return [
    selector,
    { x: [0, x], y: [0, y], opacity: [0, 1, 1, 0] },
    { duration: TRAVEL_S, ease: EASE, at },
  ];
};

/**
 * Both lanes at once. On the top one, each visitor's request reaches the API
 * and the bill grows a step. On the bottom one, twice the visitors read the
 * same file off the CDN and the bill does not move.
 *
 * The server draws the loop's last frame: the metered bill full, the flat one
 * where it always is. The loop empties the metered bar first (a single target,
 * so it slides rather than jumps) and fills it back to where the server drew it.
 */
const SEQUENCE: AnimationSequence = [
  ['[data-art="metered-bar"]', { width: METERED_EMPTY }, { duration: 0.4, ease: EASE, at: 0 }],
  ...VISITOR_YS.flatMap((_, index): Segment[] => {
    const at = START_S + index * METERED_STEP_S;
    const width = METERED_EMPTY + ((METER.width - METERED_EMPTY) * (index + 1)) / VISITOR_YS.length;

    return [
      travel(`[data-dot="metered-${index}"]`, LANE_TOPS.metered, index, at),
      ['[data-art="metered-box"]', { scale: [1, 1.06, 1] }, { duration: 0.3, at: at + TRAVEL_S - 0.05 }],
      ['[data-art="metered-bar"]', { width }, { duration: 0.35, ease: EASE, at: at + TRAVEL_S }],
    ];
  }),
  ...FLAT_REQUESTS.flatMap((visitor, index): Segment[] => {
    const at = START_S + index * FLAT_STEP_S;

    return [
      travel(`[data-dot="flat-${index}"]`, LANE_TOPS.flat, visitor, at),
      ['[data-art="flat-box"]', { scale: [1, 1.04, 1] }, { duration: 0.25, at: at + TRAVEL_S - 0.05 }],
    ];
  }),
];

/**
 * Two ways a map gets to a visitor: asked for from a metered API on every
 * load, or read from one published file on a CDN.
 */
export function ViewsArt() {
  const scope = useArtLoop<SVGSVGElement>(SEQUENCE, 1.4);

  return (
    <svg
      ref={scope}
      aria-hidden="true"
      viewBox={`0 0 ${W} ${H}`}
      className="h-full w-full"
      preserveAspectRatio="xMidYMid meet"
    >
      <Lane
        top={LANE_TOPS.metered}
        name="Metered map"
        box="API"
        boxNote="billed per load"
        price={`$${METERED_USD_PER_1000} per 1,000 views`}
        ink="var(--muted)"
        barWidth={METER.width}
        id="metered"
        dots={VISITOR_YS.map((_, index) => index)}
      />
      <Lane
        top={LANE_TOPS.flat}
        name={PRODUCT_NAME}
        box="your-map.json"
        boxNote="on a CDN"
        price={`${STARTER_PRICE} a month, flat`}
        ink={ART_PIN.accent}
        barWidth={FLAT_WIDTH}
        id="flat"
        dots={[...FLAT_REQUESTS]}
      />
    </svg>
  );
}

function Lane({
  top,
  name,
  box,
  boxNote,
  price,
  ink,
  barWidth,
  id,
  dots,
}: {
  top: number;
  name: string;
  box: string;
  boxNote: string;
  price: string;
  ink: string;
  barWidth: number;
  id: "metered" | "flat";
  /** The visitor each request dot leaves from, in the order they are sent. */
  dots: readonly number[];
}) {
  const boxY = top + BOX.top;

  return (
    <g>
      <g style={ART_RAISED}>
        <rect x={LANE.x} y={top} width={LANE.width} height={LANE.height} rx="12" fill="var(--surface)" />
      </g>

      <text x={LANE.x + 14} y={top + 20} fontSize="10" fontWeight="600" fill="var(--foreground)">
        {name}
      </text>

      {VISITOR_YS.map((y, index) => (
        <Visitor key={index} x={VISITOR_X} y={top + y} />
      ))}

      {/* The requests. Invisible at rest, at their visitor. */}
      {dots.map((visitor, index) => (
        <circle
          key={index}
          data-dot={`${id}-${index}`}
          cx={VISITOR_X + 12}
          cy={top + VISITOR_YS[visitor] + 2}
          r="3"
          fill={ink}
          opacity="0"
        />
      ))}

      <g data-art={`${id}-box`}>
        <rect
          x={BOX.x}
          y={boxY}
          width={BOX.width}
          height={BOX.height}
          rx="9"
          fill="var(--foreground)"
          fillOpacity="0.04"
          stroke={ink}
          strokeWidth="1.4"
        />
        <text
          x={BOX.x + BOX.width / 2}
          y={boxY + 19}
          textAnchor="middle"
          className="font-mono"
          fontSize={box.length > 6 ? 8.5 : 10}
          fill="var(--foreground)"
        >
          {box}
        </text>
        <text
          x={BOX.x + BOX.width / 2}
          y={boxY + 32}
          textAnchor="middle"
          fontSize="8"
          fill="var(--muted)"
        >
          {boxNote}
        </text>
      </g>

      <text x={METER.x} y={top + METER.top - 7} fontSize="8.5" fill="var(--muted)">
        Your bill
      </text>
      <rect
        x={METER.x}
        y={top + METER.top}
        width={METER.width}
        height={METER.height}
        rx={METER.height / 2}
        fill="var(--foreground)"
        opacity="0.08"
      />
      <rect
        data-art={`${id}-bar`}
        x={METER.x}
        y={top + METER.top}
        width={barWidth}
        height={METER.height}
        rx={METER.height / 2}
        fill={ink}
      />
      <text
        x={METER.x}
        y={top + METER.top + 26}
        className="font-mono"
        fontSize="8.5"
        fill="var(--foreground)"
      >
        {price}
      </text>
    </g>
  );
}

/** A person: a head and a pair of shoulders, in the muted ink. */
function Visitor({ x, y }: { x: number; y: number }) {
  return (
    <g fill="var(--muted)" opacity="0.8">
      <circle cx={x} cy={y - 3} r="3.5" />
      <path d={`M${x - 6} ${y + 8}a6 6 0 0 1 12 0Z`} />
    </g>
  );
}
