"use client";

import { animate, useReducedMotion } from "motion/react";
import { useLayoutEffect, useRef, type ReactNode } from "react";

/** The app's 150ms curve (`list-row-motion.ts`), a little longer for a height. */
const DURATION = 0.2;
const EASE = [0, 0, 0.2, 1] as const;

/**
 * A box whose height eases to whatever its content needs, instead of snapping.
 *
 * For a block whose content is swapped in place — a stepper step turning from
 * Redeploy into Add to theme, a loading line giving way to the real thing —
 * where everything under it would otherwise jump by the difference.
 *
 * **Measured, not `height: "auto"`.** A `ResizeObserver` on the content reads
 * the height it wants and the box animates to it imperatively, inside the
 * observer's callback. That runs after layout and before paint, while the box
 * still holds its old height, so the first frame painted is the start of the
 * animation. Going through React state instead left one frame with the new
 * content spilling past the old height.
 *
 * **The clip has room for focus rings.** `overflow: hidden` is what makes the
 * height animation a reveal, and it would cut off a button's focus ring at the
 * edge. So the box is 4px bigger on every side than it looks (`-m-1` with
 * `p-1` inside), which is enough for the ring and costs no layout. That margin
 * lies over whatever sits just above, so the box and its padding take no
 * pointer events — only the content does — or the bottom pixels of a title
 * row's Remove would stop answering.
 *
 * Nothing animates on the first measurement — the server-rendered height is
 * already right — and reduced motion sets it at once.
 */
export function AnimatedHeight({ children }: { children: ReactNode }) {
  const boxRef = useRef<HTMLDivElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);
  const reduceMotion = useReducedMotion();

  useLayoutEffect(() => {
    const box = boxRef.current;
    const content = contentRef.current;
    if (!box || !content) return;

    let measured = false;
    const observer = new ResizeObserver(() => {
      const height = content.offsetHeight;
      if (!measured || reduceMotion) {
        measured = true;
        box.style.height = `${height}px`;
        return;
      }
      animate(box, { height }, { duration: DURATION, ease: EASE });
    });

    observer.observe(content);
    return () => observer.disconnect();
  }, [reduceMotion]);

  return (
    <div ref={boxRef} className="pointer-events-none -m-1 overflow-hidden">
      {/* `relative`: an `AnimatePresence mode="popLayout"` inside positions its
          leaving child absolutely, against this box. */}
      <div ref={contentRef} className="relative p-1 [&>*]:pointer-events-auto">
        {children}
      </div>
    </div>
  );
}
