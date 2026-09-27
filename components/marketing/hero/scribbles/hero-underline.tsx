/**
 * A marker-pen underline under the headline's accent word.
 *
 * Two strokes rather than one, the second shorter and lower, because that is
 * what a hand does going back over a line — one clean curve reads as a CSS
 * border with a bend in it.
 *
 * It stretches to the word (`preserveAspectRatio="none"`) and sizes in `em`, so
 * it follows the headline through every breakpoint; `non-scaling-stroke` keeps
 * the pen the same width however far the stretch goes. Absolute inside an
 * inline `relative` span, so it adds nothing to the line box and cannot move
 * the text — the gap it sits in is `.mk-hero-title`'s line height.
 */
export function HeroUnderline() {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 300 20"
      preserveAspectRatio="none"
      className="pointer-events-none absolute top-[calc(100%-0.1em)] left-[-2%] h-[0.24em] w-[104%] overflow-visible"
      fill="none"
      stroke="currentColor"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path
        d="M5 12 C 70 5, 170 3, 295 8"
        strokeWidth={5}
        vectorEffect="non-scaling-stroke"
      />
      <path
        d="M38 17 C 110 12, 196 11, 262 14"
        strokeWidth={3.5}
        vectorEffect="non-scaling-stroke"
      />
    </svg>
  );
}
