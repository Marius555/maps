import type { ReactNode, Ref } from "react";

/**
 * The box the Europe map draws in: the same rounded, bordered panel as the
 * London map (`.mk-hero-map`), grown to whatever height the showcase screen
 * leaves it — see `.mk-europe-frame` in globals.css, which in dark mode also
 * takes the page's own background and drops the border, so the map lies on
 * the page rather than in a card.
 *
 * `label` is what a screen reader hears for the whole picture; everything
 * inside is decoration, the way the hero's pins are.
 */
export function MapFrame({
  label,
  frameRef,
  className = "",
  children,
}: {
  label: string;
  frameRef?: Ref<HTMLDivElement>;
  className?: string;
  children: ReactNode;
}) {
  return (
    <div
      ref={frameRef}
      role="img"
      aria-label={label}
      className={`mk-europe-frame relative overflow-hidden rounded-2xl border border-border bg-surface-secondary shadow-sm ${className}`}
    >
      {children}
    </div>
  );
}
