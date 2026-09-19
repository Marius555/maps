"use client";

import { Button } from "@heroui/react";
import { LocateFixed } from "lucide-react";

/**
 * "Nearest to me", as the embed words it.
 *
 * Armed, it fills with the accent — the convention every tool on the editor's
 * map toolbar uses for "this is on". The word goes on a phone, where the chips
 * need the row; the icon keeps an accessible name either way.
 */
export function HeroNearMe({
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
        <LocateFixed aria-hidden="true" className="size-4" />
        <span className="max-sm:sr-only">Nearest to me</span>
      </Button>
    </div>
  );
}
