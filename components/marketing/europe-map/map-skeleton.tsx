/**
 * The frame, empty, while the map's code arrives. Same box, so nothing jumps.
 * The pulse is a soft radial patch rather than a filled box, so nothing grey
 * flashes on a page the map is meant to lie on.
 */
export function MapSkeleton() {
  return (
    <div className="mk-europe-frame relative overflow-hidden rounded-2xl">
      <div className="absolute inset-0 animate-pulse bg-[radial-gradient(closest-side,color-mix(in_oklab,var(--foreground)_5%,transparent),transparent)]" />
    </div>
  );
}
