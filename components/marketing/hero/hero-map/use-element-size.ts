"use client";

import { useEffect, useState } from "react";

import type { FrameSize } from "@/lib/marketing/hero-map";

/**
 * An element's content-box size, kept current as it resizes.
 *
 * Takes the element rather than a ref so it works for something that mounts
 * later than its parent (the hero's card does): pass the node a callback ref
 * stored in state. Null until the first measurement, which on the server is
 * forever — anything drawn from it is client-only by construction.
 */
export function useElementSize(element: Element | null): FrameSize | null {
  const [size, setSize] = useState<FrameSize | null>(null);

  useEffect(() => {
    if (!element) return;

    const observer = new ResizeObserver(([entry]) => {
      const { width, height } = entry.contentRect;

      // Same numbers, same object: a re-render per observation would re-run
      // every placement below it for nothing.
      setSize((previous) =>
        previous && previous.width === width && previous.height === height
          ? previous
          : { width, height },
      );
    });

    observer.observe(element);
    return () => observer.disconnect();
  }, [element]);

  return size;
}
