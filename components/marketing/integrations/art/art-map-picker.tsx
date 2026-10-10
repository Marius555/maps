import { ART_PIN, ArtPin } from "@/components/marketing/art/art-pin";

/** Name-bar widths per row — three maps, as an account that has a few would show. */
const ROWS = [58, 44, 66] as const;

export const PICKER_ROW = 24;

/**
 * Where the map-picker's parts are, so a drawing's sequence can aim the cursor
 * at them without measuring the drawing.
 */
export function pickerLayout(x: number, y: number, width: number, height: number) {
  const rowTop = (index: number) => y + 30 + index * (PICKER_ROW + 4);
  const connect = { x: x + width - 78, y: y + height - 30, width: 66, height: 20 };

  return {
    rowTop,
    rowMid: (index: number) => ({ x: x + 70, y: rowTop(index) + PICKER_ROW / 2 }),
    connect,
    connectMid: { x: connect.x + connect.width / 2, y: connect.y + connect.height / 2 },
  };
}

/**
 * The "Choose a map" sheet the WordPress button opens on our side: a title,
 * three maps, a lit row (`data-art="picker-highlight"`, moved by its `y`) and
 * an accent **Connect** button with a check drawn on it once pressed
 * (`data-art="connect"`, `data-art="connect-check"`).
 *
 * Drawn the way the real screen reads, not the way it looks pixel for pixel —
 * a drawing that copies a UI dates the day the UI changes.
 */
export function ArtMapPicker({
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
  const { rowTop, connect } = pickerLayout(x, y, width, height);

  return (
    <g>
      <ArtPin x={x + 16} y={y + 16} color={ART_PIN.accent} r={4} />
      <text x={x + 26} y={y + 19.5} fontSize="10" fontWeight="600" fill="var(--foreground)">
        Choose a map
      </text>

      <rect
        data-art="picker-highlight"
        x={x + 8}
        y={rowTop(0)}
        width={width - 16}
        height={PICKER_ROW}
        rx="6"
        fill={ART_PIN.accent}
        fillOpacity="0.14"
      />
      {ROWS.map((name, index) => (
        <g key={index}>
          <rect
            x={x + 16}
            y={rowTop(index) + 6}
            width="12"
            height="12"
            rx="3"
            fill="var(--foreground)"
            opacity="0.1"
          />
          <rect
            x={x + 36}
            y={rowTop(index) + 7}
            width={name}
            height="5"
            rx="2.5"
            fill="var(--foreground)"
            opacity="0.5"
          />
          <rect
            x={x + 36}
            y={rowTop(index) + 15}
            width={name * 0.6}
            height="3.5"
            rx="1.75"
            fill="var(--muted)"
            opacity="0.45"
          />
        </g>
      ))}

      <g data-art="connect">
        <rect
          x={connect.x}
          y={connect.y}
          width={connect.width}
          height={connect.height}
          rx={connect.height / 2}
          fill={ART_PIN.accent}
        />
        <path
          data-art="connect-check"
          d={`M${connect.x + 11} ${connect.y + 10.5}l2.8 2.8l5.2-5.6`}
          fill="none"
          stroke="var(--accent-foreground)"
          strokeWidth="1.8"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <text
          x={connect.x + 25}
          y={connect.y + 13.5}
          fontSize="8.5"
          fontWeight="600"
          fill="var(--accent-foreground)"
        >
          Connect
        </text>
      </g>
    </g>
  );
}
