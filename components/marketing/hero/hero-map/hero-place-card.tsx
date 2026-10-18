"use client";

import { Clock, Navigation } from "lucide-react";

import {
  HERO_KINDS,
  HERO_PIN_COLORS,
  HERO_YOU_ARE_HERE,
  pinInFrame,
  projectPin,
  type FrameSize,
  type HeroPin,
} from "@/lib/marketing/hero-map";
import type { HeroRoute } from "@/lib/marketing/hero-routes";
import {
  formatDistance,
  formatDistanceM,
  formatDuration,
} from "@/packages/shared/geo";

import { HeroCardFrame } from "./hero-card-frame";

/**
 * The card a visitor opens on a pin, drawn over the hero's picture.
 *
 * It glides from pin to pin rather than closing and reopening — the spring on
 * `x`/`y` (in `HeroCardFrame`) is what makes the tour read as one card being
 * carried around the map — and its contents crossfade as it goes. Placed in
 * frame pixels, which is why it only exists once the frame has been measured.
 *
 * Decoration to a screen reader, like the pins it belongs to: the map's own
 * label says what is on it, and a card that changes every few seconds would be
 * an announcement nobody asked for.
 */
export function HeroPlaceCard({
  pin,
  km,
  route,
  frame,
}: {
  pin: HeroPin;
  /** Straight-line distance, for a pin no route was measured to. */
  km: number | null;
  /** The baked route ending at this pin, when it is the one "nearest" found. */
  route: HeroRoute | null;
  frame: FrameSize;
}) {
  const anchor = pinInFrame(projectPin(pin), frame);

  // While "Nearest to me" is on, open away from the visitor's dot so the card
  // never sits on it or on the line drawn to this pin.
  const you =
    km !== null || route ? pinInFrame(projectPin(HERO_YOU_ARE_HERE), frame) : null;
  const prefer = you && you.x > anchor.x ? "left" : "right";

  return (
    <HeroCardFrame
      anchor={anchor}
      frame={frame}
      prefer={prefer}
      contentKey={pin.name}
    >
      <CardBody pin={pin} km={km} route={route} />
    </HeroCardFrame>
  );
}

function CardBody({
  pin,
  km,
  route,
}: {
  pin: HeroPin;
  km: number | null;
  route: HeroRoute | null;
}) {
  const kind = HERO_KINDS[pin.kind];

  return (
    <div className="p-3.5">
      <p className="flex items-center gap-1.5 text-xs font-medium text-muted">
        <span
          className="size-2 rounded-full"
          style={{ background: HERO_PIN_COLORS[pin.kind] }}
        />
        {kind.one}
      </p>
      <p className="mt-1.5 text-[0.9375rem] leading-snug font-semibold tracking-tight text-foreground">
        {pin.name}
      </p>
      <p className="mt-0.5 text-sm text-pretty text-muted">{pin.street}, London</p>

      <p className="mt-2.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-foreground">
        <span className="flex items-center gap-1">
          <Clock aria-hidden="true" className="size-3.5 text-muted" />
          Open until {kind.closes}
        </span>
        {/* The route's own two numbers, worded the way the embed words them
            (packages/shared/directions.ts) — a distance along roads and the
            drive it implies, never a straight line dressed up as one. */}
        {route ? (
          <span className="flex items-center gap-1">
            <Navigation aria-hidden="true" className="size-3.5 text-accent" />
            {formatDistanceM(route.distanceM)} · {formatDuration(route.durationS)} drive
          </span>
        ) : km !== null ? (
          <span className="flex items-center gap-1">
            <Navigation aria-hidden="true" className="size-3.5 text-accent" />
            {formatDistance(km)} away
          </span>
        ) : null}
      </p>
    </div>
  );
}
