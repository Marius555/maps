/** The frame, empty, while the map's code arrives. Same box, so nothing jumps. */
export function MapSkeleton() {
  return (
    <div className="mk-europe-frame relative overflow-hidden rounded-2xl border border-border bg-surface-secondary shadow-sm">
      <div className="absolute inset-0 animate-pulse bg-foreground/[0.03]" />
    </div>
  );
}
