import { ART_RAISED } from "./art-pin";

/**
 * The place card a visitor opens, drawn small: a photo band, a name, two quiet
 * lines and an accent chip — the login panel's card, at 112×92.
 *
 * Position it 22 units right of its pin and centred on it, the offset the
 * editor anchors a real card at, so the two read as attached rather than
 * merely near each other.
 *
 * Raised by a shadow, not outlined: on a drawn map a ruled edge reads as one
 * more street.
 */
export const ART_CARD = { width: 112, height: 92 } as const;

export function ArtCard({ x, y }: { x: number; y: number }) {
  return (
    <g transform={`translate(${x} ${y})`}>
      <g style={ART_RAISED}>
        <rect width={ART_CARD.width} height={ART_CARD.height} rx="10" fill="var(--surface)" />
      </g>
      <rect x="8" y="8" width="96" height="30" rx="6" fill="var(--foreground)" opacity="0.08" />
      <rect x="8" y="46" width="58" height="6" rx="3" fill="var(--foreground)" opacity="0.55" />
      <rect x="8" y="58" width="82" height="5" rx="2.5" fill="var(--muted)" opacity="0.5" />
      <rect x="8" y="68" width="66" height="5" rx="2.5" fill="var(--muted)" opacity="0.5" />
      <rect x="8" y="79" width="34" height="8" rx="4" fill="var(--accent)" opacity="0.9" />
    </g>
  );
}
