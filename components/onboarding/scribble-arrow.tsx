import { type PlacedCallout, RING_RADIUS } from "./tutorial-layout";

/**
 * One callout's drawing: the arrow and a ring round what it points at.
 *
 * The stroke is the landing page's `HeroArrow` — `currentColor` in the accent,
 * round caps and joins — without its loop. Static, for the same reason that one
 * is: §8 keeps motion for feedback, and an arrow wiggling at you is decoration.
 *
 * The ring is there because the scrim, however light, dims the control too; it
 * gives the thing being pointed at its contrast back.
 */
export function ScribbleArrow({ callout }: { callout: PlacedCallout }) {
  const { ring, shaft, head } = callout;

  return (
    <g
      fill="none"
      stroke="currentColor"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <rect
        x={ring.left}
        y={ring.top}
        width={ring.width}
        height={ring.height}
        rx={RING_RADIUS}
        strokeWidth={2}
      />
      <path d={shaft} strokeWidth={3.5} />
      <path d={head} strokeWidth={3.5} />
    </g>
  );
}
