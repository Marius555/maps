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
 *
 * **`note` is the same two passes at a tutorial note's size.** The box is in
 * `em` but the pen is in pixels, so at the note's 20–30px the hero's 0.24em box
 * is 5–7px tall and its 5px and 3.5px strokes lay on top of each other — one
 * thick smudge, not two passes. A taller box and a finer pen keep them apart.
 */
const SIZES = {
  hero: {
    box: "top-[calc(100%-0.1em)] h-[0.24em]",
    strokes: [5, 3.5],
  },
  note: {
    // 0.42em was measured in the browser and still let the two passes touch
    // where the first one dips at its left end.
    box: "top-[calc(100%-0.06em)] h-[0.55em]",
    strokes: [2.5, 1.75],
  },
} as const;

export function HeroUnderline({ size = "hero" }: { size?: keyof typeof SIZES }) {
  const { box, strokes } = SIZES[size];

  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 300 20"
      preserveAspectRatio="none"
      className={`pointer-events-none absolute left-[-2%] w-[104%] overflow-visible ${box}`}
      fill="none"
      stroke="currentColor"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path
        d="M5 12 C 70 5, 170 3, 295 8"
        strokeWidth={strokes[0]}
        vectorEffect="non-scaling-stroke"
      />
      <path
        d="M38 17 C 110 12, 196 11, 262 14"
        strokeWidth={strokes[1]}
        vectorEffect="non-scaling-stroke"
      />
    </svg>
  );
}
