import { ART_RAISED } from "@/components/marketing/art/art-pin";

/**
 * A window or sheet laid on the drawing: a raised surface with a faint band
 * across its top. The band is a path with the window's own top corners rather
 * than a clipped rectangle, so no drawing needs a clipPath id just to have one.
 *
 * `dots` draws a browser's three dots and an address bar in the band.
 */
export function ArtWindow({
  x,
  y,
  width,
  height,
  bar = 26,
  radius = 12,
  dots = false,
}: {
  x: number;
  y: number;
  width: number;
  height: number;
  bar?: number;
  radius?: number;
  dots?: boolean;
}) {
  const r = radius;

  return (
    <g>
      <g style={ART_RAISED}>
        <rect x={x} y={y} width={width} height={height} rx={r} fill="var(--surface)" />
      </g>
      {bar > 0 ? (
        <path
          d={`M${x} ${y + r}a${r} ${r} 0 0 1 ${r} ${-r}h${width - 2 * r}a${r} ${r} 0 0 1 ${r} ${r}v${bar - r}h${-width}z`}
          fill="var(--foreground)"
          opacity="0.04"
        />
      ) : null}
      {dots ? (
        <>
          <g fill="var(--muted)" opacity="0.5">
            <circle cx={x + 14} cy={y + bar / 2} r="3" />
            <circle cx={x + 25} cy={y + bar / 2} r="3" />
            <circle cx={x + 36} cy={y + bar / 2} r="3" />
          </g>
          <rect
            x={x + 54}
            y={y + bar / 2 - 5}
            width={Math.min(150, width - 80)}
            height="10"
            rx="5"
            fill="var(--foreground)"
            opacity="0.06"
          />
        </>
      ) : null}
    </g>
  );
}
