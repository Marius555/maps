import Image from "next/image";

import { DOCS_SCREENSHOTS, type DocsScreenshot } from "@/lib/docs/screenshots.generated";

/**
 * A screenshot of the real app, in the reader's own theme.
 *
 * Every shot exists twice, `-light` and `-dark`, taken by
 * `npm run docs:screenshots` (e2e/docs-screenshots/capture.spec.ts). Both are in
 * the markup and the theme class shows one; the other is `display: none` and
 * lazy, so the browser never fetches it. A light screenshot in a dark guide is
 * the same glare this redesign removed from the text.
 *
 * `shot` is typed against the generated manifest, so a figure naming a shot the
 * capture does not take fails the typecheck rather than drawing a broken image.
 * The manifest's size reserves the box, so nothing below it moves as it loads.
 *
 * `unoptimized`: the files are already sized JPEGs, and nothing else on the
 * public site runs through the image optimiser, which on Appwrite Sites would be
 * one more thing in the standalone build to keep working for twelve pictures.
 */
export function DocsFigure({
  shot,
  alt,
  caption,
}: {
  shot: DocsScreenshot;
  alt: string;
  caption?: string;
}) {
  const { width, height } = DOCS_SCREENSHOTS[shot];
  const common = {
    width,
    height,
    unoptimized: true,
    loading: "lazy" as const,
    sizes: "(min-width: 1024px) 44rem, 100vw",
  };

  return (
    <figure className="space-y-2.5">
      <div className="overflow-hidden rounded-xl border border-border bg-surface">
        <Image
          src={`/docs/screenshots/${shot}-light.jpg`}
          alt={alt}
          {...common}
          className="h-auto w-full dark:hidden"
        />
        <Image
          src={`/docs/screenshots/${shot}-dark.jpg`}
          alt={alt}
          {...common}
          className="hidden h-auto w-full dark:block"
        />
      </div>
      {caption && (
        <figcaption className="text-pretty text-[0.8125rem]/5 text-muted">{caption}</figcaption>
      )}
    </figure>
  );
}
