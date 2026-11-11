"use client";

import type { AnimationSequence } from "motion/react";

import { arriveMap, centreOf, clearMap, EASE, holdUntil, typing } from "../stage/pass-kit";
import { useHoverPlay } from "../stage/use-hover-play";
import { BrowserWindow } from "./browser-window";
import { CodePill } from "./code-pill";

/** One character at a time, the way typing looks. */
const TYPE = typing(32);

/**
 * The pass: the map on their page empties; the line types itself, the cursor
 * presses copy and the check draws; the line flies into the page; and the map
 * arrives — the ground spreading from the middle, the pins dropping, the route
 * drawing itself, as on the showcase map. Ends on the drawing at rest.
 *
 * The flight is measured at play time, from the pill to the map inside the
 * tilted window, so it lands in the right place at every width.
 */
function buildPass(root: HTMLElement): AnimationSequence {
  const from = centreOf(root, '[data-art="pill"]');
  const to = centreOf(root, '[data-art="window-map"]');

  return [
    ...clearMap(0),

    ['[data-art="code"]', { clipPath: "inset(0% 100% 0% 0%)" }, { duration: 0.01, at: 0.4 }],
    ['[data-art="check"]', { pathLength: 0 }, { duration: 0.01, at: 0.4 }],
    ['[data-art="code"]', { clipPath: "inset(0% 0% 0% 0%)" }, { duration: 1, ease: TYPE, at: 0.5 }],

    ['[data-art="cursor"]', { scale: [1, 0.78, 1] }, { duration: 0.3, at: 1.65 }],
    ['[data-art="copy"]', { scale: [1, 1.18, 1] }, { duration: 0.35, at: 1.72 }],
    ['[data-art="check"]', { pathLength: 1 }, { duration: 0.35, ease: EASE, at: 1.75 }],

    ['[data-art="ghost"]', { opacity: 1 }, { duration: 0.1, at: 2.2 }],
    [
      '[data-art="ghost"]',
      { x: [from.x, to.x], y: [from.y, to.y], scale: [1, 0.55] },
      { duration: 0.6, ease: EASE, at: 2.2 },
    ],
    ['[data-art="ghost"]', { opacity: 0 }, { duration: 0.15, at: 2.7 }],

    ...arriveMap(2.75),

    ...holdUntil(5.6),
  ];
}

/**
 * Step three: their own website with the map in it, and the one line that put
 * it there. At rest the paste has happened; on hover it happens again.
 */
export default function PublishArt() {
  const scope = useHoverPlay<HTMLDivElement>(buildPass);

  return (
    <div ref={scope} aria-hidden="true" className="absolute inset-0 overflow-hidden">
      <BrowserWindow />
      <CodePill />

      <span
        data-art="ghost"
        className="absolute top-0 left-0 z-20 -translate-1/2 rounded-full bg-foreground px-2 py-1 font-mono text-[9px] whitespace-nowrap text-background shadow-md"
        style={{ opacity: 0 }}
      >
        {"<script>"}
      </span>
      <span data-art="hold" className="hidden" />
    </div>
  );
}
