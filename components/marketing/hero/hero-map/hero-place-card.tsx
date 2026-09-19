"use client";

import { Clock, Navigation } from "lucide-react";
import { AnimatePresence, motion } from "motion/react";
import { useState } from "react";

import {
  HERO_KINDS,
  HERO_PIN_COLORS,
  HERO_YOU_ARE_HERE,
  pinInFrame,
  placeCard,
  projectPin,
  type CardInsets,
  type FrameSize,
  type HeroPin,
} from "@/lib/marketing/hero-map";
import type { HeroRoute } from "@/lib/marketing/hero-routes";
import {
  formatDistance,
  formatDistanceM,
  formatDuration,
} from "@/packages/shared/geo";

import { useElementSize } from "./use-element-size";

/**
 * What the card keeps clear of: the chips and "Nearest to me" along the top,
 * the ⓘ in the bottom corner.
 */
const INSETS: CardInsets = { top: 64, right: 12, bottom: 44, left: 12 };

/** Used for the one frame before the card has measured itself. */
const ESTIMATE: FrameSize = { width: 224, height: 118 };

/** Where the card grows from: the side facing its pin. */
const ORIGIN = {
  right: "0% 50%",
  left: "100% 50%",
  below: "50% 0%",
  above: "50% 100%",
} as const;

/**
 * The card a visitor opens on a pin, drawn over the hero's picture.
 *
 * It glides from pin to pin rather than closing and reopening — the spring on
 * `x`/`y` is what makes the tour read as one card being carried around the map
 * — and its contents crossfade as it goes. Placed in frame pixels by
 * `placeCard`, which is why it only exists once the frame has been measured.
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
  const [node, setNode] = useState<HTMLDivElement | null>(null);
  const size = useElementSize(node);
  const anchor = pinInFrame(projectPin(pin), frame);

  // While "Nearest to me" is on, open away from the visitor's dot so the card
  // never sits on it or on the line drawn to this pin.
  const you =
    km !== null || route ? pinInFrame(projectPin(HERO_YOU_ARE_HERE), frame) : null;
  const prefer = you && you.x > anchor.x ? "left" : "right";

  const placed = placeCard(anchor, size ?? ESTIMATE, frame, INSETS, prefer);

  return (
    <motion.div
      ref={setNode}
      aria-hidden="true"
      className="pointer-events-none absolute top-0 left-0 z-10 w-56 rounded-xl bg-surface shadow-lg shadow-black/10"
      style={{ transformOrigin: ORIGIN[placed.side] }}
      initial={{ opacity: 0, scale: 0.92, x: placed.x, y: placed.y }}
      animate={{ opacity: 1, scale: 1, x: placed.x, y: placed.y }}
      exit={{ opacity: 0, scale: 0.92 }}
      transition={{
        type: "spring",
        stiffness: 240,
        damping: 30,
        opacity: { duration: 0.18 },
      }}
    >
      <AnimatePresence mode="popLayout" initial={false}>
        <motion.div
          key={pin.name}
          initial={{ opacity: 0, y: 4 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.2 }}
        >
          <CardBody pin={pin} km={km} route={route} />
        </motion.div>
      </AnimatePresence>
    </motion.div>
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
