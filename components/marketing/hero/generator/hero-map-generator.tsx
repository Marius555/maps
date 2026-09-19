"use client";

import { Button } from "@heroui/react";
import { useCallback, useState } from "react";

import {
  HERO_LOOKS,
  HERO_PINS,
  HERO_PIXEL_RATIOS,
  HERO_SIZE,
} from "@/lib/marketing/hero-map";

import { HeroPinMarker, heroPinPosition } from "../hero-map/hero-pin-marker";

type Rendered = {
  name: string;
  url: string;
  bytes: number;
  pixelRatio: number;
};

const SIZE = new Intl.NumberFormat("en-GB", { maximumFractionDigits: 0 });

/**
 * Renders the hero's basemap images, to be saved into `public/marketing/`.
 *
 * Each result is shown with the pins laid over it exactly as the landing page
 * lays them, so a change to `HERO_CAMERA` can be checked for a pin in the river
 * before anything is committed.
 */
export function HeroMapGenerator() {
  const [rendered, setRendered] = useState<Rendered[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  const render = useCallback(async () => {
    setPending(true);
    setError(null);
    setRendered([]);

    try {
      const { renderHeroMap } = await import("./render-hero-map");
      const results: Rendered[] = [];

      // One at a time: each render holds a WebGL context until it is torn down.
      for (const look of HERO_LOOKS) {
        for (const pixelRatio of HERO_PIXEL_RATIOS) {
          const blob = await renderHeroMap(look.style, pixelRatio);

          results.push({
            name: `${look.file}${pixelRatio === 1 ? "" : `@${pixelRatio}x`}.webp`,
            url: URL.createObjectURL(blob),
            bytes: blob.size,
            pixelRatio,
          });
          setRendered([...results]);
        }
      }
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : String(caught));
    } finally {
      setPending(false);
    }
  }, []);

  return (
    <div className="mx-auto max-w-6xl space-y-8 px-5 py-10">
      <div className="space-y-2">
        <h1 className="text-2xl font-semibold text-foreground">Hero map images</h1>
        <p className="text-sm text-muted">
          Renders every look at {HERO_SIZE.width}×{HERO_SIZE.height} and each
          pixel ratio. Save them into <code>public/marketing/</code> under the
          names shown.
        </p>
        <Button onPress={render} isPending={pending}>
          Render images
        </Button>
        {error ? <p className="text-sm text-danger">{error}</p> : null}
      </div>

      {rendered.map((image) => (
        <figure key={image.name} className="space-y-2">
          <figcaption className="flex items-center gap-4 text-sm">
            <span className="font-mono text-foreground">{image.name}</span>
            <span className="text-muted">{SIZE.format(image.bytes / 1024)} KB</span>
            <a className="text-accent underline" href={image.url} download={image.name}>
              Download
            </a>
          </figcaption>

          <div
            className="relative w-full overflow-hidden rounded-xl border border-border"
            style={{ aspectRatio: `${HERO_SIZE.width} / ${HERO_SIZE.height}` }}
          >
            {/* eslint-disable-next-line @next/next/no-img-element -- a blob URL, nothing to optimise */}
            <img src={image.url} alt="" className="absolute inset-0 h-full w-full" />
            {HERO_PINS.map((pin) => (
              <span key={pin.name} className="mk-hero-pin" style={heroPinPosition(pin)}>
                <HeroPinMarker pin={pin} />
              </span>
            ))}
          </div>
        </figure>
      ))}
    </div>
  );
}
