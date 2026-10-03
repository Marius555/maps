"use client";

import { Button } from "@heroui/react";
import { ChevronLeft, ChevronRight } from "lucide-react";

/**
 * Previous and next — drawn only when there is more than one photo.
 *
 * Over the photo's two edges rather than in a row under it, so a tall photo
 * keeps the whole height of the screen. The position is announced but not
 * drawn: a visible "1 / 4" was asked to go.
 */
export function LightboxNav({
  index,
  count,
  onStep,
}: {
  index: number;
  count: number;
  onStep: (delta: number) => void;
}) {
  if (count < 2) return null;

  const arrow =
    "absolute top-1/2 size-11 min-w-0 -translate-y-1/2 rounded-full bg-white/12 text-white hover:bg-white/24";

  return (
    <>
      <p className="sr-only" aria-live="polite">
        {index + 1} / {count}
      </p>
      <Button
        aria-label="Previous photo"
        isIconOnly
        variant="ghost"
        onPress={() => onStep(-1)}
        className={`${arrow} start-3`}
      >
        <ChevronLeft aria-hidden="true" className="size-6" />
      </Button>
      <Button
        aria-label="Next photo"
        isIconOnly
        variant="ghost"
        onPress={() => onStep(1)}
        className={`${arrow} end-3`}
      >
        <ChevronRight aria-hidden="true" className="size-6" />
      </Button>
    </>
  );
}
