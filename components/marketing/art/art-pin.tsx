/**
 * The drawings' two pin inks: the accent for the one pin a scene is about, and
 * the muted ink for every other one.
 *
 * Two and not five. The drawings used to give each pin a category hue — violet,
 * blue, green — and with the accent and the greys that was six colours in a
 * picture 360 units wide, which read as confetti rather than as a map. One
 * colour doing the pointing is what makes the pointing legible.
 */
export const ART_PIN = {
  accent: "var(--accent)",
  muted: "var(--muted)",
} as const;

/**
 * A lift for the panels drawn on the card: a soft shadow in place of an
 * outline, so a white sheet on the pale ground reads as a sheet without a
 * border around it.
 */
export const ART_RAISED = {
  filter:
    "drop-shadow(0 1px 1.5px oklch(0% 0 0 / 0.07)) drop-shadow(0 6px 14px oklch(0% 0 0 / 0.07))",
} as const;

/**
 * The editor's plain pin: a coloured ball with a ring of the page behind it,
 * which is what separates it from whatever it happens to be sitting on. `halo`
 * marks the one pin a scene is about.
 *
 * A muted pin is drawn at 0.75, the opacity the login panel measured on the
 * dark theme: any lower and it reads as a smudge on the ground rather than as
 * a place.
 */
export function ArtPin({
  x,
  y,
  color = ART_PIN.muted,
  r = 6,
  halo = false,
}: {
  x: number;
  y: number;
  color?: string;
  r?: number;
  halo?: boolean;
}) {
  return (
    <g>
      {halo ? <circle cx={x} cy={y} r={r * 2.4} fill={color} opacity="0.18" /> : null}
      <circle
        cx={x}
        cy={y}
        r={r}
        fill={color}
        stroke="var(--surface)"
        strokeWidth="2.5"
        opacity={color === ART_PIN.muted ? 0.75 : 1}
      />
    </g>
  );
}
