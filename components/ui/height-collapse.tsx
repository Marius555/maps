"use client";

import { useReducedMotion } from "motion/react";
import { useLayoutEffect, useRef, useState, type CSSProperties, type ReactNode } from "react";

/** The variable React Aria writes on a disclosure panel — and `reveal-fold` reads. */
const HEIGHT_VAR = "--disclosure-panel-height";

/** Longer than the 200ms transition: a guard for a `transitionend` that never comes. */
const SETTLE_MS = 400;

/**
 * A block that folds shut to nothing, on **exactly** the motion a HeroUI
 * accordion panel uses — so the two can run as one.
 *
 * Made for the Publish footer (owner's request, 2026-11-07): opening a fold
 * in the designer slides the steps under it away to their heading row, and
 * closing it brings them back. One fold grows while this shrinks, in the same
 * frame, so anything less than the same curve reads as two things happening.
 * Hence HeroUI's own values (`@heroui/styles/dist/components/accordion.css`):
 * `height` over 200ms on `--ease-out-quad`, opacity beside it, and
 * `motion-reduce:transition-none`.
 *
 * **The same mechanism, too.** The height goes through
 * `--disclosure-panel-height`, written in a layout effect — what React Aria does
 * for its panels — so `lib/ui/reveal-fold.ts` can read where this is going on
 * the first frame, as it does for a fold. `data-height-collapse` is how it
 * finds this one.
 *
 * - **Shutting:** the current height in pixels, a forced layout so that is the
 *   start, then `0px`.
 * - **Opening:** the content's height in pixels, then `auto` once the
 *   transition ends, so anything inside that grows later (a stepper step's own
 *   `AnimatedHeight`) is not clipped at the size it opened to. Under reduced
 *   motion there is no transition to wait for, so `auto` is written at once.
 *
 * Shut, it is `inert`: nothing folded away can take focus or be read. Any gap
 * above the content belongs *inside* it, so shut costs no space at all.
 */
export function HeightCollapse({
  isCollapsed,
  className = "",
  children,
}: {
  isCollapsed: boolean;
  className?: string;
  children: ReactNode;
}) {
  const boxRef = useRef<HTMLDivElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);
  const reduceMotion = useReducedMotion();

  // The first paint is set by the markup, so a server-rendered page is already
  // the right height and nothing animates on load. React writes this style
  // once: it never changes, so it never fights the effect below.
  const [initialStyle] = useState(
    () => ({ [HEIGHT_VAR]: isCollapsed ? "0px" : "auto" }) as CSSProperties,
  );
  const isFirst = useRef(true);

  useLayoutEffect(() => {
    const box = boxRef.current;
    const content = contentRef.current;
    if (!box || !content) return;

    if (isFirst.current) {
      isFirst.current = false;
      return;
    }

    const setHeight = (value: string) => box.style.setProperty(HEIGHT_VAR, value);

    if (isCollapsed) {
      setHeight(`${box.offsetHeight}px`);
      // Read back so the pixel height is laid out as the start; otherwise the
      // browser sees `auto → 0`, which does not transition.
      void box.offsetHeight;
      setHeight("0px");
      return;
    }

    setHeight(`${content.offsetHeight}px`);
    if (reduceMotion) {
      setHeight("auto");
      return;
    }

    const open = () => setHeight("auto");
    const onEnd = (event: TransitionEvent) => {
      if (event.target === box && event.propertyName === "height") open();
    };
    const timer = window.setTimeout(open, SETTLE_MS);
    box.addEventListener("transitionend", onEnd);

    return () => {
      window.clearTimeout(timer);
      box.removeEventListener("transitionend", onEnd);
    };
  }, [isCollapsed, reduceMotion]);

  return (
    <div
      ref={boxRef}
      data-height-collapse=""
      data-collapsed={isCollapsed || undefined}
      inert={isCollapsed}
      style={initialStyle}
      className={`h-(--disclosure-panel-height) overflow-clip transition-[height,opacity] duration-200 ease-(--ease-out-quad) motion-reduce:transition-none ${
        isCollapsed ? "opacity-0" : "opacity-100"
      }`}
    >
      <div ref={contentRef} className={className}>
        {children}
      </div>
    </div>
  );
}
