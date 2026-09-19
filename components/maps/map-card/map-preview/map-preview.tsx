"use client";

import { useState } from "react";

import { ThemeSwatch } from "@/components/appearance/theme-swatch";
import type { AppMap } from "@/lib/repositories/types";
import { useMapPreview } from "./use-map-preview";

/**
 * The map itself, at the top of its card.
 *
 * A fixed 16:10 box, so nothing around it moves whatever is inside. Underneath
 * is the basemap picker's own swatch for this style — instant, zero requests, and
 * already the right colours — and over it the real rendered map once there is
 * one (use-map-preview.ts). The swatch's viewBox is 64×40, the same 16:10, so it
 * fills the box without stretching.
 *
 * `alt=""`: the card's title already names the map, and a screen reader reading
 * "map of Stockists" before "Stockists" says it twice.
 */
export function MapPreview({
  map,
  contentVersion,
  children,
}: {
  map: AppMap;
  contentVersion: string | undefined;
  /** Drawn over the map — the status chip. */
  children?: React.ReactNode;
}) {
  const src = useMapPreview(map, contentVersion);
  const [loadedSrc, setLoadedSrc] = useState<string | null>(null);

  return (
    <div className="relative aspect-[16/10] w-full overflow-hidden border-b border-border bg-surface-secondary">
      <div aria-hidden="true" className="absolute inset-0">
        <ThemeSwatch style={map.style} />
      </div>

      {src ? (
        // eslint-disable-next-line @next/next/no-img-element -- a local object URL; next/image cannot optimise a blob.
        <img
          src={src}
          alt=""
          draggable={false}
          onLoad={() => setLoadedSrc(src)}
          /*
           * Faded in once, when the first picture arrives, to say the placeholder
           * became the real thing. A replacement for a stale picture swaps
           * instantly — it is the same map, one edit newer.
           */
          className={`absolute inset-0 size-full select-none object-cover transition-opacity duration-300 motion-reduce:transition-none ${
            loadedSrc ? "opacity-100" : "opacity-0"
          }`}
        />
      ) : null}

      {children}
    </div>
  );
}
