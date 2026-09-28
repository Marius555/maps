"use client";

import { useLayoutEffect, useRef, useState } from "react";

import { HeroUnderline } from "@/components/marketing/hero/scribbles/hero-underline";

type Line = { left: number; top: number; width: number; height: number };

/**
 * A note's title in the landing hero's lettering, with its marker underline
 * under every line.
 *
 * The hero underlines one word that never wraps, so one absolute underline
 * sized to its span is enough there. A title here wraps on a phone, and that
 * approach breaks both ways it can be tried: on an inline-block the underline
 * spans the whole box rather than the words, and on a plain inline span the
 * containing box is the first line's alone. So the lines are measured — one
 * rect per wrapped line from the text's own client rects — and each gets an
 * underline the width of its words.
 *
 * The line height is opened up from `.mk-display`'s 0.96, which leaves no gap
 * for an underline between two lines; inline, because `.mk-display` is
 * unlayered and a `leading-*` utility would lose to it silently.
 */
export function UnderlinedTitle({ title }: { title: string }) {
  const titleRef = useRef<HTMLParagraphElement>(null);
  const textRef = useRef<HTMLSpanElement>(null);
  const [lines, setLines] = useState<Line[]>([]);

  useLayoutEffect(() => {
    const box = titleRef.current;
    const text = textRef.current;
    if (!box || !text) return;

    let last = "";
    const measure = () => {
      const next = measureLines(box, text);
      const key = JSON.stringify(next);
      if (key === last) return;
      last = key;
      setLines(next);
    };

    measure();
    // The font arriving and the note being resized both move the breaks.
    const observer = new ResizeObserver(measure);
    observer.observe(box);
    void document.fonts?.ready.then(measure);

    return () => observer.disconnect();
  }, [title]);

  return (
    <p
      ref={titleRef}
      style={{ lineHeight: 1.3 }}
      className="mk-display relative pb-[0.2em] text-xl text-balance text-accent sm:text-3xl"
    >
      <span ref={textRef}>{title}</span>
      {lines.map((line, index) => (
        <span
          key={index}
          aria-hidden="true"
          className="pointer-events-none absolute"
          style={line}
        >
          <HeroUnderline />
        </span>
      ))}
    </p>
  );
}

/** One box per wrapped line, relative to the title. */
function measureLines(box: HTMLElement, text: HTMLElement): Line[] {
  const origin = box.getBoundingClientRect();
  const range = document.createRange();
  range.selectNodeContents(text);

  const lines: Line[] = [];

  for (const rect of range.getClientRects()) {
    if (rect.width === 0) continue;

    const top = rect.top - origin.top;
    const same = lines.find((line) => Math.abs(line.top - top) < 2);

    // A line can come back as more than one rect; join them into one.
    if (same) {
      const right = Math.max(same.left + same.width, rect.right - origin.left);
      same.left = Math.min(same.left, rect.left - origin.left);
      same.width = right - same.left;
    } else {
      lines.push({ left: rect.left - origin.left, top, width: rect.width, height: rect.height });
    }
  }

  return lines.map((line) => ({
    left: Math.round(line.left),
    top: Math.round(line.top),
    width: Math.round(line.width),
    height: Math.round(line.height),
  }));
}
