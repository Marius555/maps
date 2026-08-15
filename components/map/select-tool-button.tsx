"use client";

import { SquareDashedMousePointer } from "lucide-react";

import { IconButton } from "@/components/ui/icon-button";

/**
 * Arms the marquee.
 *
 * An icon button rather than a labelled one, unlike Add and Draw. Those two put
 * something new on the map and a label is what says the mode is on; this one
 * only changes what a drag means, and the pressed state plus the crosshair say
 * that well enough to be worth the width on a phone.
 *
 * Pressing it again stops — the same toggle the other two tools use, so the
 * three controls beside each other behave alike.
 */
export function SelectToolButton({
  isSelecting,
  onStartSelecting,
  onStopSelecting,
}: {
  isSelecting: boolean;
  onStartSelecting: () => void;
  onStopSelecting: () => void;
}) {
  return (
    <IconButton
      label={isSelecting ? "Stop selecting" : "Select several"}
      icon={SquareDashedMousePointer}
      placement="bottom"
      variant={isSelecting ? "primary" : "tertiary"}
      aria-pressed={isSelecting}
      onPress={isSelecting ? onStopSelecting : onStartSelecting}
    />
  );
}
