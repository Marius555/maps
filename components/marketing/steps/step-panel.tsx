"use client";

import { useMemo, useState } from "react";

import { PlayHint } from "./stage/play-hint";
import { StepHoverContext } from "./stage/step-hover";

/**
 * One step: a drawing, then a title and one line under it.
 *
 * **A flat card: one surface, no outline, no wash.** It used to carry a border,
 * a gradient tint and a "01" over the title; the drawing in it is what the eye
 * should land on, and each of those was a second thing competing with it. The
 * order the three steps come in is the order they are read in, which says
 * "sequence" without a numeral.
 *
 * **The whole card is the hover target**, and the drawing plays only while it
 * is hovered (stage/use-hover-play.ts). The hover state is handed down by
 * context, and the drawing hands back whether it is still playing, so the
 * "Hover to play" chip returns only once the drawing has come to rest.
 *
 * The drawing sits in a box of its own at its own 3:2, rather than filling the
 * panel and being cropped. These are three panels whose width changes with every
 * breakpoint, and cropping would take a different bite out of each scene at each
 * one.
 */
export function StepPanel({
  title,
  subtitle,
  art,
}: {
  title: string;
  subtitle: string;
  art: React.ReactNode;
}) {
  const [hovered, setHovered] = useState(false);
  const [playing, setPlaying] = useState(false);
  const hover = useMemo(() => ({ hovered, setPlaying }), [hovered]);

  return (
    <article
      className="mk-panel flex h-full flex-col overflow-hidden rounded-2xl"
      onPointerEnter={() => setHovered(true)}
      onPointerLeave={() => setHovered(false)}
    >
      <div className="relative aspect-[3/2] w-full">
        <StepHoverContext value={hover}>{art}</StepHoverContext>
        <PlayHint hidden={hovered || playing} />
      </div>

      <div className="px-6 pt-1 pb-7">
        <h3 className="text-xl leading-snug font-semibold tracking-tight text-balance text-foreground lg:text-2xl">
          {title}
        </h3>
        <p className="mt-2 text-sm text-pretty text-muted">{subtitle}</p>
      </div>
    </article>
  );
}
