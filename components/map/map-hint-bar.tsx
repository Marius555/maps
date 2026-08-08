/**
 * The "click the map" hint.
 *
 * Bottom-centre, not top-centre: the toolbar wraps onto a second line on narrow
 * viewports and used to collide with this. The bottom edge is also where the eye
 * ends up after reading the toolbar, and it clears the attribution because that
 * sits bottom-right.
 */
export function MapHintBar({ isVisible }: { isVisible: boolean }) {
  if (!isVisible) return null;

  return (
    <div className="pointer-events-none absolute inset-x-0 bottom-3 z-10 flex justify-center px-3">
      <p
        className="rounded-full border border-border bg-surface px-3 py-1.5 text-xs text-foreground shadow-sm"
        role="status"
      >
        Click the map to add a location. Press Esc to stop.
      </p>
    </div>
  );
}
