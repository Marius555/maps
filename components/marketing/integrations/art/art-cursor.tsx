/** A press: the cursor dips and comes back. Starts at rest, so it is loop-safe. */
export const PRESS = { scale: [1, 0.82, 1] };

export type ArtPoint = { x: number; y: number };

/** How far the cursor moves from where it rests to put its tip on `to`. */
export function cursorTo(rest: ArtPoint, to: ArtPoint): ArtPoint {
  return { x: to.x - rest.x, y: to.y - rest.y };
}

/**
 * The drawings' cursor, tip at `rest`. Placed by the outer group and moved by
 * the inner path (`data-art="cursor"`), so a transform written by the animation
 * never replaces the one that positions it — the arrangement publish-art.tsx
 * uses. Draw it last, so it is over everything it presses.
 */
export function ArtCursor({ x, y }: ArtPoint) {
  return (
    <g transform={`translate(${x} ${y})`}>
      <path
        data-art="cursor"
        d="M0 0L0 15L4 11.2L7 18L9.6 16.9L6.7 10.2L12 10.2Z"
        fill="var(--surface)"
        stroke="var(--foreground)"
        strokeWidth="1.2"
        strokeLinejoin="round"
      />
    </g>
  );
}
