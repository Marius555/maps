import type { Segment } from "motion/react";

import { ART_PIN, ArtPin } from "@/components/marketing/art/art-pin";

/**
 * A pin that drops onto the map rather than rippling out of it.
 *
 * The pin is a group (`data-drop`) with a soft shadow on the ground under it
 * (`data-shadow`). The shadow is what sells the landing: it grows in as the
 * pin comes down, so the pin reads as arriving from above rather than fading
 * in where it stands.
 *
 * Drawn standing — the server's frame is the finished map — and moved only by
 * `liftPins` and `dropPins`, whose tracks are all single targets, so nothing
 * here can be caught by the "first keyframe is held from time zero" trap that
 * use-art-loop.ts describes.
 */
export function ArtDropPin({
  id,
  x,
  y,
  color = ART_PIN.muted,
  r = 6,
  halo = false,
}: {
  id: string;
  x: number;
  y: number;
  color?: string;
  r?: number;
  halo?: boolean;
}) {
  return (
    <g>
      <ellipse
        data-shadow={id}
        cx={x}
        cy={y + r + 3}
        rx={r * 0.95}
        ry="1.8"
        fill="var(--foreground)"
        fillOpacity="0.2"
      />
      <g data-drop={id}>
        <ArtPin x={x} y={y} color={color} r={r} halo={halo} />
      </g>
    </g>
  );
}

const LIFT = 16;

/** Takes the pins off the map: up and out, shadows shrinking. */
export function liftPins(ids: readonly string[], at: number): Segment[] {
  return ids.flatMap((id): Segment[] => [
    [`[data-drop="${id}"]`, { opacity: 0, y: -LIFT }, { duration: 0.25, at }],
    [`[data-shadow="${id}"]`, { opacity: 0, scale: 0.3 }, { duration: 0.25, at }],
  ]);
}

/**
 * Puts them back one after another: each falls into place with a slight
 * overshoot (`backOut`) and settles, its shadow spreading under it as it lands.
 */
export function dropPins(ids: readonly string[], at: number, stagger = 0.1): Segment[] {
  return ids.flatMap((id, index): Segment[] => {
    const start = at + index * stagger;

    return [
      [`[data-drop="${id}"]`, { opacity: 1, y: 0 }, { duration: 0.5, ease: "backOut", at: start }],
      [`[data-shadow="${id}"]`, { opacity: 1, scale: 1 }, { duration: 0.3, at: start + 0.18 }],
    ];
  });
}
