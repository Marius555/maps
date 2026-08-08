/** Placeholder with the canvas's exact footprint, so nothing shifts on load. */
export function MapSkeleton() {
  return (
    <div
      className="flex h-full w-full items-center justify-center bg-surface-secondary"
      role="status"
      aria-label="Loading map"
    >
      <span className="text-sm text-muted">Loading map…</span>
    </div>
  );
}
