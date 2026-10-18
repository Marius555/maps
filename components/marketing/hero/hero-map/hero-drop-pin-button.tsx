"use client";

import { Button } from "@heroui/react";
import { MapPinPlus } from "lucide-react";

/**
 * "Drop a pin": arms one placement on the hero map, the editor's own gesture.
 *
 * A tool rather than a property of the ground, because pressing the ground is
 * also how a card is closed, and a map that left a pin wherever it was clicked
 * filled up with pins nobody meant (owner, 2026-10-18). Pressed, it fills with
 * the accent until the pin lands or Escape cancels — the same "this is on" as
 * "Nearest to me" beside it, whose markup this mirrors.
 */
export function HeroDropPinButton({
  active,
  onToggle,
}: {
  active: boolean;
  onToggle: () => void;
}) {
  return (
    <div className="map-chrome-panel shrink-0 rounded-full p-1 shadow-sm">
      <Button
        size="sm"
        variant={active ? "primary" : "tertiary"}
        aria-pressed={active}
        onPress={onToggle}
        className="rounded-full max-sm:px-2"
      >
        <MapPinPlus aria-hidden="true" className="size-4" />
        <span className="max-sm:sr-only">Drop a pin</span>
      </Button>
    </div>
  );
}
