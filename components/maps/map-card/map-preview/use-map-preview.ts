"use client";

import { useEffect, useState } from "react";

import { readPreview, writePreview } from "@/lib/map-preview/cache";
import { enqueue } from "@/lib/map-preview/queue";
import { previewKey } from "@/lib/map-preview/version";
import type { AppMap } from "@/lib/repositories/types";
import { usePrefersDark } from "@/lib/theme/use-prefers-dark";

/**
 * The picture a map card shows, as an object URL — or null until there is one.
 *
 * Cache first: a picture rendered on an earlier visit shows at once, and if its
 * key still matches nothing else happens. When it does not, the old picture
 * stays up while the new one renders behind it — a slightly stale map is a
 * better placeholder than no map — and is swapped for it when it lands.
 *
 * `contentVersion` comes from the server's summary; a map created since the page
 * loaded has none yet, and its own `updatedAt` stands in until the next load.
 */
export function useMapPreview(map: AppMap, contentVersion: string | undefined) {
  const prefersDark = usePrefersDark();
  const [src, setSrc] = useState<string | null>(null);

  const key = previewKey({
    contentVersion: contentVersion ?? map.updatedAt,
    style: map.style,
    prefersDark,
  });

  const { id: mapId, style, appearance } = map;

  useEffect(() => {
    let cancelled = false;
    const urls: string[] = [];

    const show = (blob: Blob) => {
      if (cancelled) return;
      const url = URL.createObjectURL(blob);
      urls.push(url);
      setSrc(url);
    };

    void (async () => {
      const cached = await readPreview(mapId);
      if (cancelled) return;

      if (cached) show(cached.blob);
      if (cached?.key === key) return;

      const blob = await enqueue(async () => {
        await whenVisible();
        const { renderPreview } = await import("./render-preview");
        return renderPreview({ mapId, style, appearance, prefersDark });
      }, () => cancelled);

      if (!blob || cancelled) return;

      await writePreview(mapId, { key, blob });
      show(blob);
    })().catch((error: unknown) => {
      // The swatch, or the last good picture, stays. The next visit tries again.
      console.error("[map-preview]", mapId, error);
    });

    return () => {
      cancelled = true;
      for (const url of urls) URL.revokeObjectURL(url);
    };
  }, [key, mapId, style, appearance, prefersDark]);

  return src;
}

/**
 * A hidden tab does not paint — `requestAnimationFrame` stops — so a map built
 * in one never reaches `idle`, and the render would time out and fail. Waiting
 * for the tab to come back costs nothing and turns that failure into a delay.
 */
function whenVisible(): Promise<void> {
  if (document.visibilityState === "visible") return Promise.resolve();

  return new Promise((resolve) => {
    const onChange = () => {
      if (document.visibilityState !== "visible") return;
      document.removeEventListener("visibilitychange", onChange);
      resolve();
    };

    document.addEventListener("visibilitychange", onChange);
  });
}
