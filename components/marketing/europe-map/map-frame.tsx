import type { ReactNode, Ref } from "react";

/**
 * The box the Europe map draws in, grown to whatever height the showcase screen
 * leaves it at `lg` and up, and aspect-sized below — see `.mk-europe-frame` in
 * globals.css. No border, no fill but the page's own, in either mode: the map
 * lies on the page rather than in a card.
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
      className={`mk-europe-frame relative overflow-hidden rounded-2xl ${className}`}
    >
      {children}
    </div>
  );
}
