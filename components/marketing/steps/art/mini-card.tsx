import { Clock, Navigation } from "lucide-react";

import { HERO_KINDS, HERO_PIN_COLORS } from "@/lib/marketing/hero-map";

import type { StagePlace } from "../stage/stage-data";

/**
 * A pin's card, standing over it, in the two layouts the design drawing flips
 * between: a photo card (at rest) and a compact row with a directions button.
 * `data-face` is what the pass crossfades while the card is edge-on.
 */
export function MiniCard({ place }: { place: StagePlace }) {
  const kind = HERO_KINDS[place.kind];
  const color = HERO_PIN_COLORS[place.kind];

  return (
    <div
      data-art="card"
      className="relative mb-1.5 w-[7.25rem] overflow-hidden rounded-lg border border-border bg-surface text-[9px] leading-tight shadow-md"
    >
      <div data-face="a">
        <div
          className="h-5"
          style={{ background: `linear-gradient(120deg, ${color}, color-mix(in oklab, ${color} 45%, var(--surface)))` }}
        />
        <div className="px-2 py-1.5">
          <p className="text-[10px] font-semibold text-foreground">
            {place.name} {kind.one.toLowerCase()}
          </p>
          <p className="mt-0.5 flex items-center gap-1 text-muted">
            <Clock className="size-2.5" />
            Open until {kind.closes}
          </p>
        </div>
      </div>

      <div data-face="b" className="absolute inset-0 flex items-center gap-1.5 px-2" style={{ opacity: 0 }}>
        <span className="size-4 shrink-0 rounded-full" style={{ backgroundColor: color }} />
        <span className="min-w-0 flex-1">
          <span className="block truncate text-[10px] font-semibold text-foreground">{place.name}</span>
          <span className="block text-muted">{kind.one}</span>
        </span>
        <span className="grid size-5 shrink-0 place-items-center rounded-full bg-accent text-accent-foreground">
          <Navigation className="size-2.5" />
        </span>
      </div>
    </div>
  );
}
