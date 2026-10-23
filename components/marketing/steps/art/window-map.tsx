import { useId } from "react";

import { DotField } from "../../europe-map/dot-field";
import { smoothPath } from "../../europe-map/smooth-path";
import { PinMark } from "../stage/pin-mark";
import { STAGE_DOT, STAGE_VIEW, stagePlace, stagePlaces } from "../stage/stage-data";

const PLACES = stagePlaces(["Amsterdam", "Paris", "Berlin", "Zurich", "Vienna", "Milan"]);
const ROUTE = smoothPath(["Amsterdam", "Paris", "Zurich", "Milan"].map(stagePlace));

/** Far enough from the middle to uncover every corner. */
export const REVEAL_R = Math.hypot(STAGE_VIEW.width, STAGE_VIEW.height) / 2 + STAGE_DOT;

/**
 * The map as it appears on somebody's own page: flat, the dotted ground, the
 * chain's pins and a route between four of them.
 *
 * The ground is uncovered by one circle in a mask (`data-art="reveal"`, its
 * `r` animated) rather than by fading ~600 dots one by one; `data-wpin` and
 * `data-art="route"` are the publish pass's other hooks.
 */
export function WindowMap() {
  const mask = `mk-step-reveal-${useId().replace(/[^a-zA-Z0-9_-]/g, "")}`;

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
            d={ROUTE}
            fill="none"
            stroke="var(--accent)"
            strokeWidth={9}
            strokeLinecap="round"
          />
        </svg>

        {PLACES.map((place) => (
          <span
            key={place.name}
            className="absolute size-0"
            style={{ left: `${place.left}%`, top: `${place.top}%` }}
          >
            <span data-wpin className="mk-step-pin mk-step-pin--flat absolute -translate-1/2">
              <PinMark kind={place.kind} />
            </span>
          </span>
        ))}
      </div>
    </div>
  );
}
