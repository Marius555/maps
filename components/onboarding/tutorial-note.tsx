import type { CSSProperties } from "react";

import { UnderlinedTitle } from "./underlined-title";

/**
 * The words at the tail of an arrow.
 *
 * On a near-opaque surface rather than straight on the scrim: behind it is a
 * map, and text over a map is only legible where the map happens to be plain.
 *
 * Always rendered, hidden until placed — its height decides where the next note
 * goes, so it has to exist to be measured before it can be positioned.
 */
export function TutorialNote({
  id,
  title,
  body,
  position,
  describedBy,
}: {
  id: string;
  title: string;
  body: string;
  position: { left: number; top: number } | undefined;
  describedBy: string;
}) {
  const style: CSSProperties = position
    ? { left: position.left, top: position.top }
    : { left: 0, top: 0, visibility: "hidden" };

  return (
    <div
      id={describedBy}
      data-tutorial-note={id}
      style={style}
      // `100vw - 8rem`, not `- 2rem`: on a phone the notes stack under their
      // targets, and the lower note's arrow has to climb past the upper note.
      // The spare left-hand column is the lane it climbs in, and a note sized to
      // its text is pushed back into that lane by the right-edge clamp whenever
      // it is wider than this — measured at 390px, `- 6rem` let it graze.
      className="pointer-events-auto absolute w-max max-w-[calc(100vw-8rem)] rounded-xl border border-border bg-surface/95 px-4 py-3 shadow-lg"
    >
      {/* The landing hero's lettering and underline, so the first thing a new
          account sees is written in the hand that sold it to them. */}
      <UnderlinedTitle title={title} />
      {/* Capped on its own: the note is `w-max`, so a longer body would
          otherwise stretch it into one line as wide as the screen allows. */}
      <p className="mt-2 max-w-[22rem] text-sm text-muted">{body}</p>
    </div>
  );
}
