import { useId, type CSSProperties, type ReactNode } from "react";

import { DotField } from "../../europe-map/dot-field";
import { STAGE_DOT, STAGE_VIEW } from "./stage-data";

/** The ground's tilt away from the viewer and its turn, in degrees. Pins undo both. */
export const STAGE_TILT = 54;
export const STAGE_SPIN = -10;

/** What a pin standing on the ground wears to face the viewer square — see StagePin. */
export const FACE_VIEWER = `rotate(${-STAGE_SPIN}deg) rotateX(${-STAGE_TILT}deg)`;

/**
 * The ground every step drawing stands on: the dotted patch of Europe laid on
 * a table and seen in perspective, as the showcase map draws the whole of it.
 *
 * Real CSS 3D (`.mk-step-plane` keeps `preserve-3d`), so a pin placed on it
 * with `StagePin` stands up off it. **Nothing may set opacity, a filter or a
 * mask on the plane itself** — any of them flattens it and lays every pin down;
 * fade what is on it instead.
 *
 * `place` puts the plane in the drawing (its centre and width); `ground`
 * replaces the plain dots, for the design drawing's changing looks. Children
 * are HTML on the ground, placed by percent.
 */
export function StepStage({
  place,
  ground,
  children,
}: {
  place: { left: string; top: string; width: string };
  ground?: (dotsMask: string) => ReactNode;
  children?: ReactNode;
}) {
  const mask = `mk-step-fade-${useId().replace(/[^a-zA-Z0-9_-]/g, "")}`;
  const plane: CSSProperties = {
    ...place,
    aspectRatio: `${STAGE_VIEW.width} / ${STAGE_VIEW.height}`,
    transform: `rotateX(${STAGE_TILT}deg) rotate(${STAGE_SPIN}deg)`,
  };

  return (
    <div className="mk-step-scene absolute inset-0">
      <div data-art="plane" className="mk-step-plane" style={plane}>
        <svg
          viewBox={`0 0 ${STAGE_VIEW.width} ${STAGE_VIEW.height}`}
          className="absolute inset-0 size-full overflow-visible"
        >
          <defs>
            <radialGradient id={`${mask}-g`} cx="50%" cy="50%" r="55%">
              <stop offset="55%" stopColor="#fff" />
              <stop offset="100%" stopColor="#fff" stopOpacity={0} />
            </radialGradient>
            <mask id={mask}>
              <rect width={STAGE_VIEW.width} height={STAGE_VIEW.height} fill={`url(#${mask}-g)`} />
            </mask>
          </defs>

          {ground ? (
            ground(`url(#${mask})`)
          ) : (
            <g mask={`url(#${mask})`}>
              <DotField grid="europe" view={STAGE_VIEW} radius={STAGE_DOT} className="text-foreground/30" />
            </g>
          )}
        </svg>

        {children}
      </div>

      {/* The far edge fades into the panel, so the ground has a horizon, not a cut. */}
      <div className="mk-step-haze pointer-events-none absolute inset-x-0 top-0 h-1/4" />
    </div>
  );
}
