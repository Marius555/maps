import {
  HERO_KIND_ORDER,
  HERO_KINDS,
  HERO_PIN_COLORS,
} from "@/lib/marketing/hero-map";

/**
 * The chain's three kinds as a key, in the map chrome's glass panel — the
 * embed's tag filter reduced to what a picture can say.
 */
export function MapLegend({ className = "" }: { className?: string }) {
  return (
    <ul
      className={`map-chrome-panel flex items-center gap-3 rounded-full px-3 py-1.5 text-xs font-medium shadow-sm ${className}`}
    >
      {HERO_KIND_ORDER.map((kind) => (
        <li key={kind} className="flex items-center gap-1.5">
          <span
            aria-hidden="true"
            className="size-2 rounded-full"
            style={{ backgroundColor: HERO_PIN_COLORS[kind] }}
          />
          {HERO_KINDS[kind].many}
        </li>
      ))}
    </ul>
  );
}
