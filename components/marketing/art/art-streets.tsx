/**
 * A few blocks and streets: enough to read as "a map" without inviting anyone
 * to work out where. Drawn inside whatever box the caller clips it to.
 *
 * `ink` is what the blocks and roads are drawn in, at low opacity — the page's
 * foreground by default, the surface when the ground under it is dark.
 */
export function ArtStreets({
  x,
  y,
  width,
  height,
  ink = "var(--foreground)",
}: {
  x: number;
  y: number;
  width: number;
  height: number;
  ink?: string;
}) {
  return (
    <g transform={`translate(${x} ${y})`}>
      <g fill={ink} opacity="0.06">
        <rect x={width * 0.06} y={height * 0.1} width={width * 0.3} height={height * 0.24} rx="3" />
        <rect x={width * 0.5} y={height * 0.06} width={width * 0.36} height={height * 0.2} rx="3" />
        <rect x={width * 0.12} y={height * 0.52} width={width * 0.26} height={height * 0.3} rx="3" />
        <rect x={width * 0.56} y={height * 0.46} width={width * 0.34} height={height * 0.36} rx="3" />
      </g>
      <g fill="none" stroke={ink} strokeLinecap="round" opacity="0.12">
        <path
          d={`M0 ${height * 0.42}C${width * 0.3} ${height * 0.36} ${width * 0.6} ${height * 0.46} ${width} ${height * 0.38}`}
          strokeWidth="5"
        />
        <path
          d={`M${width * 0.44} 0C${width * 0.4} ${height * 0.4} ${width * 0.5} ${height * 0.7} ${width * 0.46} ${height}`}
          strokeWidth="4"
        />
      </g>
    </g>
  );
}
