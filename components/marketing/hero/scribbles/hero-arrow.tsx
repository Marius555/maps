/**
 * A hand-drawn arrow that comes down, loops once and lands on the headline.
 *
 * It lives in the empty space right of the headline: a short stroke drops from
 * above the first line, loops to the left beside "locations,", crosses itself
 * and sweeps a short way down-left onto the end of "on your own site.". The
 * loop is the gesture and the tails are kept short either side of it.
 * Accent-coloured and at the underline's pen width, so the two read as marks
 * made with the same marker.
 *
 * **Hung off the `h1`, not the section.** The hero's column is centred
 * vertically, so a position measured from the section would aim at a different
 * spot on every window height. From the headline's own foot, in `em`, it keeps
 * its aim and scales with the type.
 *
 * **`xl` and up only.** Below that there is no free space beside the headline:
 * at 1024px the first line alone takes about 860 of the column's 960px, and on
 * a phone the text is the whole width. It is absolute, so hiding it moves
 * nothing. At `xl` it spans from just past "site." to within a few pixels of
 * the 72rem column's right edge — widen it and it starts a horizontal scroll.
 *
 * Static on purpose: §8 keeps motion for feedback, and an arrow drawing itself
 * in tells the visitor nothing.
 */
export function HeroArrow() {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 400 200"
      className="pointer-events-none absolute top-[-0.9em] left-[9.25em] hidden h-[2.8em] w-[5.6em] overflow-visible text-accent xl:block"
      fill="none"
      stroke="currentColor"
      strokeWidth={5}
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      {/* The stroke: a short drop from above the first line, a small loop to
          the left beside "locations,", then across itself down to the head. */}
      <path d="M160 34 C 155 58, 147 82, 138 104 C 128 128, 110 140, 92 136 C 70 131, 60 108, 66 88 C 74 64, 104 52, 128 62 C 152 72, 160 96, 146 122 C 128 160, 80 184, 14 188" />
      {/* The head, open, as two separate flicks of the pen. */}
      <path d="M41 164 C 30 172, 22 180, 14 188" />
      <path d="M14 188 C 24 194, 35 200, 46 205" />
    </svg>
  );
}
