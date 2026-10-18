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
 * `unoptimized`: the files are already sized WebPs, and the image optimiser is
 * off app-wide — `sharp` is kept out of the deploy package, which Appwrite caps
 * at ~30MB (`images` in next.config.ts, docs/notes/deploy.md). WebP rather than
 * JPEG for the same cap: half the bytes at the same pixels.
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
          src={`/docs/screenshots/${shot}-light.webp`}
          alt={alt}
          {...common}
          className="h-auto w-full dark:hidden"
        />
        <Image
          src={`/docs/screenshots/${shot}-dark.webp`}
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
