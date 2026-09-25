"use client";

import { Button } from "@heroui/react";
import { useCallback, useEffect, useState } from "react";

import {
  THEME_IMAGE_PIXEL_RATIOS,
  THEME_IMAGE_SIZE,
  THEME_IMAGE_VARIANTS,
  themeImageFileName,
} from "@/lib/map/theme-images";

type Rendered = {
  name: string;
  url: string;
  bytes: number;
};

const SIZE = new Intl.NumberFormat("en-GB", { maximumFractionDigits: 0 });

/**
 * Renders every theme picture and saves each into `public/map-themes/` as it
 * lands, showing it here so a picture with text or a blank frame is caught
 * before it is committed.
 */
export function ThemeImageGenerator() {
  const [rendered, setRendered] = useState<Rendered[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  const render = useCallback(async () => {
    setPending(true);
    setError(null);
    setRendered([]);

    try {
      const { renderThemeImage } = await import("./render-theme-image");
      const results: Rendered[] = [];

      // One at a time: each render holds a WebGL context until it is torn down.
      for (const variant of THEME_IMAGE_VARIANTS) {
        for (const pixelRatio of THEME_IMAGE_PIXEL_RATIOS) {
          const blob = await renderThemeImage(variant, pixelRatio);
          const name = themeImageFileName(variant.name, pixelRatio);

          const response = await fetch(
            `/dev/map-themes/save?name=${encodeURIComponent(name)}`,
            { method: "POST", body: blob },
          );
          if (!response.ok) {
            throw new Error(`Couldn't save ${name}: ${await response.text()}`);
          }

          results.push({ name, url: URL.createObjectURL(blob), bytes: blob.size });
          setRendered([...results]);
        }
      }
      document.title = "done";
    } catch (caught) {
      const message = caught instanceof Error ? caught.message : String(caught);
      setError(message);
      document.title = `failed: ${message}`;
    } finally {
      setPending(false);
    }
  }, []);

  /*
   * `?run=1` starts on load, so a headless Chrome can regenerate the pictures
   * with nobody pressing anything; the title says when it has finished. On a
   * timer rather than called here, so development's double mount cancels the
   * first start instead of running two renders side by side.
   */
  useEffect(() => {
    if (new URLSearchParams(window.location.search).get("run") !== "1") return;
    const timer = setTimeout(() => void render(), 0);
    return () => clearTimeout(timer);
  }, [render]);

  return (
    <div className="mx-auto max-w-6xl space-y-8 px-5 py-10">
      <div className="space-y-2">
        <h1 className="text-2xl font-semibold text-foreground">Map theme images</h1>
        <p className="text-sm text-muted">
          Renders every theme at {THEME_IMAGE_SIZE.width}×{THEME_IMAGE_SIZE.height} and
          each pixel ratio, with no labels, and saves them into{" "}
          <code>public/map-themes/</code>. Keep this tab visible while it runs.
        </p>
        <Button onPress={render} isPending={pending}>
          Render and save
        </Button>
        {error ? <p className="text-sm text-danger">{error}</p> : null}
        {rendered.length > 0 ? (
          <p className="text-sm text-muted">
            Saved {rendered.length} of{" "}
            {THEME_IMAGE_VARIANTS.length * THEME_IMAGE_PIXEL_RATIOS.length}
          </p>
        ) : null}
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        {rendered.map((image) => (
          <figure key={image.name} className="space-y-2">
            <figcaption className="flex items-center gap-4 text-sm">
              <span className="font-mono text-foreground">{image.name}</span>
              <span className="text-muted">{SIZE.format(image.bytes / 1024)} KB</span>
            </figcaption>
            {/* eslint-disable-next-line @next/next/no-img-element -- a blob URL, nothing to optimise */}
            <img
              src={image.url}
              alt=""
              className="w-full rounded-xl border border-border"
              style={{ aspectRatio: `${THEME_IMAGE_SIZE.width} / ${THEME_IMAGE_SIZE.height}` }}
            />
          </figure>
        ))}
      </div>
    </div>
  );
}
