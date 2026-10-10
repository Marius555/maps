import { ART_PIN, ArtPin } from "@/components/marketing/art/art-pin";

/** Where **Set up this map** sits in a placeholder drawn at `(x, y)`. */
export function setupButton(x: number, y: number) {
  const button = { x: x + 16, y: y + 50, width: 96, height: 22 };

  return { ...button, mid: { x: button.x + button.width / 2, y: button.y + button.height / 2 } };
}

/**
 * The Pinglide map block as WordPress shows it before it is set up: a dashed
 * box, the block's name, a line of help and **Set up this map**
 * (`data-art="setup"`). The label is the plugin's own (`blocks/map/block.json`).
 */
export function ArtBlockPlaceholder({
  x,
  y,
  width,
  height,
}: {
  x: number;
  y: number;
  width: number;
  height: number;
}) {
  const button = setupButton(x, y);

  return (
    <g>
      <rect
        x={x + 0.5}
        y={y + 0.5}
        width={width - 1}
        height={height - 1}
        rx="8"
        fill="var(--foreground)"
        fillOpacity="0.03"
        stroke="var(--muted)"
        strokeOpacity="0.55"
        strokeDasharray="4 3"
      />
      <ArtPin x={x + 22} y={y + 20} color={ART_PIN.accent} r={5} />
      <text x={x + 34} y={y + 24} fontSize="11" fontWeight="600" fill="var(--foreground)">
        Pinglide map
      </text>
      <rect x={x + 16} y={y + 35} width={Math.min(150, width - 32)} height="5" rx="2.5" fill="var(--muted)" opacity="0.45" />
      <g data-art="setup">
        <rect
          x={button.x}
          y={button.y}
          width={button.width}
          height={button.height}
          rx={button.height / 2}
          fill="var(--foreground)"
        />
        <text
          x={button.mid.x}
          y={button.y + 14.5}
          textAnchor="middle"
          fontSize="9"
          fontWeight="500"
          fill="var(--background)"
        >
          Set up this map
        </text>
      </g>
    </g>
  );
}
