import { useId, useMemo } from "react";

import { DotField } from "../../europe-map/dot-field";
import { smoothPath } from "../../europe-map/smooth-path";
import { PinMark } from "../stage/pin-mark";
import { STAGE_DOT, STAGE_VIEW, stagePlace, stagePlaces } from "../stage/stage-data";

const PLACES = ["Amsterdam", "Paris", "Berlin", "Zurich", "Vienna", "Milan"] as const;
const ROUTE = ["Amsterdam", "Paris", "Zurich", "Milan"] as const;

/** Far enough from the middle to uncover every corner. */
export const REVEAL_R = Math.hypot(STAGE_VIEW.width, STAGE_VIEW.height) / 2 + STAGE_DOT;

/**
 * The map as it appears on somebody's own page: flat, the dotted ground, the
 * chain's pins and a route between four of them.
 *
 * The ground is uncovered by one circle in a mask (`data-art="reveal"`, its
 * `r` animated) rather than by fading ~600 dots one by one; `data-wpin` and
 * `data-art="route"` are the publish pass's other hooks (`clearMap` and
 * `arriveMap` in ../stage/pass-kit.ts play them). Each pin's `data-wpin` is its
 * place's name, so a pass can drop one pin on its own.
 *
 * `places` and `route` default to the chain the landing page's publish drawing
 * shows; the platform pages' drawings pass their own. Both are names from
 * `EUROPE_PLACES` inside the stage's crop.
 */
export function WindowMap({
  places = PLACES,
  route = ROUTE,
}: {
  places?: readonly string[];
  route?: readonly string[];
} = {}) {
  const mask = `mk-step-reveal-${useId().replace(/[^a-zA-Z0-9_-]/g, "")}`;
  const pins = useMemo(() => stagePlaces(places), [places]);
  const path = useMemo(() => smoothPath(route.map(stagePlace)), [route]);

  return (
    <div className="absolute inset-0 grid place-items-center">
      <div
        data-art="window-map"
        className="relative h-full"
        style={{ aspectRatio: `${STAGE_VIEW.width} / ${STAGE_VIEW.height}` }}
      >
        <svg viewBox={`0 0 ${STAGE_VIEW.width} ${STAGE_VIEW.height}`} className="absolute inset-0 size-full">
          <defs>
            <mask id={mask}>
              <circle
                data-art="reveal"
                cx={STAGE_VIEW.width / 2}
                cy={STAGE_VIEW.height / 2}
                r={REVEAL_R}
                fill="#fff"
              />
            </mask>
          </defs>
          <g mask={`url(#${mask})`}>
            <DotField grid="europe" view={STAGE_VIEW} radius={STAGE_DOT * 1.15} className="text-foreground/25" />
          </g>
          <path
            data-art="route"
            d={path}
            fill="none"
            stroke="var(--accent)"
            strokeWidth={9}
            strokeLinecap="round"
          />
        </svg>

        {pins.map((place) => (
          <span
            key={place.name}
            className="absolute size-0"
            style={{ left: `${place.left}%`, top: `${place.top}%` }}
          >
            <span data-wpin={place.name} className="mk-step-pin mk-step-pin--flat absolute -translate-1/2">
              <PinMark kind={place.kind} />
            </span>
          </span>
        ))}
      </div>
    </div>
  );
}
