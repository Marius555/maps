"use client";

import { stagger, type AnimationSequence } from "motion/react";

import { useHoverPlay } from "../stage/use-hover-play";
import { BrowserWindow } from "./browser-window";
import { CodePill } from "./code-pill";
import { REVEAL_R } from "./window-map";

const EASE = [0.4, 0, 0.2, 1] as const;
const CODE_CHARS = 32;
/** One character at a time, the way typing looks. */
const TYPE = (t: number) => Math.round(t * CODE_CHARS) / CODE_CHARS;

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
  const box = root.getBoundingClientRect();
  const centre = (selector: string) => {
    const r = root.querySelector(selector)?.getBoundingClientRect();
    return r
      ? { x: r.left + r.width / 2 - box.left, y: r.top + r.height / 2 - box.top }
      : { x: 0, y: 0 };
  };
  const from = centre('[data-art="pill"]');
  const to = centre('[data-art="window-map"]');

  return [
    ['[data-art="reveal"]', { r: 0 }, { duration: 0.4, ease: "easeIn", at: 0 }],
    ["[data-wpin]", { y: -6, opacity: 0 }, { duration: 0.25, at: 0 }],
    ['[data-art="route"]', { opacity: 0 }, { duration: 0.2, at: 0 }],
    ['[data-art="route"]', { pathLength: 0 }, { duration: 0.01, at: 0.25 }],

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

    ['[data-art="reveal"]', { r: REVEAL_R }, { duration: 0.9, ease: "easeOut", at: 2.75 }],
    ["[data-wpin]", { y: 0, opacity: 1 }, { duration: 0.4, ease: "backOut", delay: stagger(0.07), at: 2.95 }],
    ['[data-art="route"]', { opacity: 1 }, { duration: 0.01, at: 3.5 }],
    ['[data-art="route"]', { pathLength: 1 }, { duration: 0.9, ease: EASE, at: 3.5 }],

    ['[data-art="hold"]', { opacity: 1 }, { duration: 0.01, at: 5.6 }],
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
