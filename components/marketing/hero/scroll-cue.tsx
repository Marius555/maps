/**
 * The bottom of a screen, saying there is another one under it.
 *
 * A page that moves a whole screen at a time has to say so, and the hero no
 * longer has a map hanging off its bottom edge to imply it. This is the
 * replacement: a label and an arrow at the foot of the first screen.
 *
 * **CSS, not Motion, and that is the same rule the hero pins follow.** The
 * animation is decoration on something that is already legible at rest, so it
 * costs nothing to leave to the stylesheet — and a `motion` component would
 * ship its `initial` as an inline style during SSR, which is the bug
 * components/marketing/reveal.tsx exists to avoid. `.mk-scroll-cue__arrow` in
 * globals.css holds the movement and switches it off under
 * `prefers-reduced-motion`, where the arrow simply sits still. The arrow
 * pointing down is the static form, and it says the whole thing on its own.
 *
 * `aria-hidden` on the arrow only: the label is real text and a screen reader
 * reading "See the map" needs no glyph after it.
 */
export function ScrollCue({ label }: { label: string }) {
  return (
    <p className="mk-scroll-cue relative mx-auto flex w-full max-w-6xl items-center gap-2 pt-6 text-xs text-muted">
      {label}
      <svg
        aria-hidden="true"
        viewBox="0 0 16 16"
        className="mk-scroll-cue__arrow size-3.5"
        fill="none"
        stroke="currentColor"
        strokeWidth={1.6}
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <path d="M8 3v10M4 9l4 4 4-4" />
      </svg>
    </p>
  );
}
