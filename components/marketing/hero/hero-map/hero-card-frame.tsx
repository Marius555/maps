"use client";

import { AnimatePresence, motion } from "motion/react";
import { useState } from "react";

import {
  placeCard,
  type CardInsets,
  type FramePoint,
  type FrameSize,
} from "@/lib/marketing/hero-map";

import { useElementSize } from "./use-element-size";

/**
 * What a card keeps clear of: the chips and "Nearest to me" along the top,
 * the ⓘ and the drop hint along the bottom.
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
 * The box every card on the hero map sits in: placed beside its pin by
 * `placeCard`, in frame pixels, gliding to the next pin rather than closing
 * and reopening, with its contents crossfading on `contentKey`.
 *
 * `interactive` is for a card with something to press in it. Every other card
 * lets the pointer through, so it never blocks a pin it happens to cover, and
 * is hidden from a screen reader like the pins it belongs to.
 */
export function HeroCardFrame({
  anchor,
  frame,
  prefer,
  contentKey,
  interactive = false,
  children,
}: {
  /** The pin, in frame pixels. */
  anchor: FramePoint;
  frame: FrameSize;
  prefer: "left" | "right";
  contentKey: string;
  interactive?: boolean;
  children: React.ReactNode;
}) {
  const [node, setNode] = useState<HTMLDivElement | null>(null);
  const size = useElementSize(node);
  const placed = placeCard(anchor, size ?? ESTIMATE, frame, INSETS, prefer);

  return (
    <motion.div
      ref={setNode}
      aria-hidden={interactive ? undefined : true}
      className={`absolute top-0 left-0 z-10 w-56 rounded-xl bg-surface shadow-lg shadow-black/10 ${
        interactive ? "" : "pointer-events-none"
      }`}
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
          key={contentKey}
          initial={{ opacity: 0, y: 4 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.2 }}
        >
          {children}
        </motion.div>
      </AnimatePresence>
    </motion.div>
  );
}
