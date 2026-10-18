"use client";

import { MapPin } from "lucide-react";

import { LinkButton } from "@/components/ui/link-button";
import {
  pinInFrame,
  projectPin,
  type FrameSize,
} from "@/lib/marketing/hero-map";

import { HeroCardFrame } from "./hero-card-frame";
import type { DroppedPin } from "./use-hero-map";

const COORD = new Intl.NumberFormat("en-GB", {
  minimumFractionDigits: 4,
  maximumFractionDigits: 4,
});

/**
 * The card on a pin the visitor dropped: where it landed, what the editor
 * would do next, and the way in.
 *
 * **Coordinates, never an address.** Turning a click into a street name is a
 * reverse geocode — a metered lookup run by a stranger on a marketing page,
 * which is exactly what CLAUDE.md §2 and the lookup allowance exist to stop.
 * The coordinates are free and true, and the sentence under them says where
 * the address comes from in the product.
 *
 * The one card on the map with something to press, so it takes the pointer
 * and stays in the accessibility tree.
 */
export function HeroDroppedCard({
  pin,
  frame,
}: {
  pin: DroppedPin;
  frame: FrameSize;
}) {
  const anchor = pinInFrame(projectPin(pin), frame);
  const prefer = anchor.x > frame.width / 2 ? "left" : "right";

  return (
    <HeroCardFrame
      anchor={anchor}
      frame={frame}
      prefer={prefer}
      contentKey={String(pin.id)}
      interactive
    >
      <div className="p-3.5">
        <p className="flex items-center gap-1.5 text-xs font-medium text-muted">
          <MapPin aria-hidden="true" className="size-3.5 text-accent" />
          You dropped a pin
        </p>
        <p className="mt-1.5 text-[0.9375rem] leading-snug font-semibold tracking-tight text-foreground">
          New location
        </p>
        <p className="mt-0.5 text-xs text-muted tabular-nums">
          {COORD.format(pin.lat)}, {COORD.format(pin.lng)}
        </p>
        <p className="mt-2 text-xs text-pretty text-foreground">
          That’s how a location starts in the editor. Drop it, drag it, or
          import a whole spreadsheet.
        </p>
        <LinkButton href="/signup" size="sm" className="mt-3 w-full">
          Start free
        </LinkButton>
      </div>
    </HeroCardFrame>
  );
}
