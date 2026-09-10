import { PRODUCT_NAME } from "@/lib/config";

/**
 * The left half of the auth screen.
 *
 * **Drawn, not photographed, and that was a decision rather than a shortcut.**
 * There is not one image in `/public` — the 5,463 files under it are map tiles —
 * so a photo would have meant sourcing, licensing and shipping an asset whose
 * only job is to be looked at once. This is a few hundred bytes of markup that
 * says what the product does: pins on a map, a route between them, and a card
 * open on one of them.
 *
 * **Every colour is a theme token**, so the panel crossfades with the rest of the
 * app when the theme changes (see the `@property` block in globals.css). A
 * hardcoded palette here would leave a light rectangle sitting on a near-black
 * page for the length of every toggle, which is exactly the tell that a screen
 * was pasted in from somewhere else.
 *
 * Hidden below `lg` rather than stacked. On a phone this is decoration above the
 * only thing on the page anyone came for, and it would push the first field
 * under the fold.
 */
export function AuthVisual() {
  return (
    <div className="auth-visual relative hidden overflow-hidden bg-surface-secondary lg:flex lg:w-1/2 lg:flex-col lg:justify-end">
      <Diagram />

      {/* Above the drawing, and readable over it: the wash below the copy is
          what guarantees that, rather than trusting the diagram to stay light
          where the words are. */}
      <div className="auth-visual__scrim relative z-10 px-12 pt-24 pb-12">
        <p className="text-sm font-semibold tracking-tight text-foreground">
          {PRODUCT_NAME}
        </p>
        <p className="mt-3 max-w-sm text-2xl leading-snug font-semibold tracking-tight text-balance text-foreground">
          Your locations, on your own site.
        </p>
        <p className="mt-3 max-w-sm text-sm text-pretty text-muted">
          Import a spreadsheet, style the map, paste one line of code. No API
          keys, no per-view billing.
        </p>
      </div>
    </div>
  );
}

/**
 * `slice` rather than `meet`: the panel is a tall column of unknown height and
 * the drawing should fill it and be cropped, the way a photograph would be —
 * `meet` would letterbox it and leave bands of flat colour top and bottom.
 */
function Diagram() {
  return (
    <svg
      aria-hidden="true"
      className="absolute inset-0 h-full w-full"
      viewBox="0 0 420 560"
      preserveAspectRatio="xMidYMid slice"
    >
      <defs>
        {/* The ground: a wash of the accent at the top left, fading out well
            before the copy starts. Kept in oklab so the mix does not pass
            through grey the way an sRGB interpolation of a saturated colour
            does. */}
        <linearGradient id="auth-wash" x1="0" y1="0" x2="1" y2="1">
          <stop
            offset="0%"
            stopColor="color-mix(in oklab, var(--accent) 18%, transparent)"
          />
          <stop offset="70%" stopColor="transparent" />
        </linearGradient>

        <pattern
          id="auth-grid"
          width="42"
          height="42"
          patternUnits="userSpaceOnUse"
        >
          <path
            d="M42 0H0V42"
            fill="none"
            stroke="var(--border)"
            strokeWidth="1"
          />
        </pattern>
      </defs>

      <rect width="420" height="560" fill="url(#auth-grid)" />
      <rect width="420" height="560" fill="url(#auth-wash)" />

      {/*
        Blocks, not countries. Enough to read as "somewhere" without inviting
        anyone to work out where.

        Spread across the full 560 rather than clustered, because the panel is a
        column of unknown height and `slice` crops the top and bottom off first —
        anything that mattered up there would be the thing that disappeared on a
        short window.
      */}
      <g fill="var(--foreground)" opacity="0.05">
        <path d="M-20 34h150v70H-20z" />
        <path d="M258 -20h120v96H258z" />
        <path d="M46 178h104v84H46z" />
        <path d="M330 236h110v104H330z" />
        <path d="M-20 306h132v78H-20z" />
        <path d="M158 396h150v96H158z" />
      </g>

      {/*
        The route, drawn under the pins so a stop sits on top of its own line.

        The whole scene lives between y 90 and y 290 on purpose: the copy's
        scrim owns everything below about y 343 (see `.auth-visual__scrim`), and
        the first version of this put the card squarely inside it — the card came
        out as a grey smudge with its accent chip invisible, which is the one
        element on the panel that is actually saying what the product does.

        **The route ends at the open pin, and that is a fix rather than a
        composition.** It used to carry on to a fourth stop up and to the right,
        which is exactly where the card is: the line ran behind the card and
        stopped dead at its edge, and the stop itself was completely hidden. A
        card is anchored to the *last* thing you pressed, so ending here is also
        the truer picture.
      */}
      <path
        className="auth-visual__route"
        d="M64 96C104 76 132 96 150 124C168 152 156 176 178 196C202 218 216 224 238 238"
        fill="none"
        stroke="var(--accent)"
        strokeWidth="2.5"
        strokeLinecap="round"
        strokeDasharray="6 7"
        opacity="0.7"
      />

      <Pin x={64} y={96} muted />
      <Pin x={150} y={124} muted />
      <Pin x={178} y={196} muted />

      {/*
        The card, echoing the real one: a photo band, a name, two quiet lines and
        a chip. Offset from its pin by the same arithmetic the editor uses —
        22px to the right, centred vertically — so the two read as anchored
        rather than merely adjacent (see `.map-card-anchor__card` in globals.css).
      */}
      <g transform="translate(260 192)">
        <rect
          width="112"
          height="92"
          rx="10"
          fill="var(--surface)"
          stroke="var(--border)"
          strokeWidth="1"
        />
        <rect
          x="8"
          y="8"
          width="96"
          height="30"
          rx="6"
          fill="var(--foreground)"
          opacity="0.08"
        />
        <rect x="8" y="46" width="58" height="6" rx="3" fill="var(--foreground)" opacity="0.55" />
        <rect x="8" y="58" width="82" height="5" rx="2.5" fill="var(--muted)" opacity="0.5" />
        <rect x="8" y="68" width="66" height="5" rx="2.5" fill="var(--muted)" opacity="0.5" />
        <rect x="8" y="79" width="34" height="8" rx="4" fill="var(--accent)" opacity="0.85" />
      </g>

      {/* The open pin, last so it sits above its own card's corner. The halo is
          the only animation on the panel and the only accent fill besides the
          route — it is what says *which* pin the card belongs to. */}
      <circle
        className="auth-visual__pulse"
        cx="238"
        cy="238"
        r="10"
        fill="var(--accent)"
        opacity="0.25"
      />
      <Pin x={238} y={238} />
    </svg>
  );
}

/**
 * The same ball the editor draws, at the same proportions: a coloured dot with a
 * ring of the page behind it. The ring is what separates a pin from whatever it
 * happens to be sitting on, which here is sometimes a block and sometimes the
 * bare grid.
 */
function Pin({ x, y, muted = false }: { x: number; y: number; muted?: boolean }) {
  return (
    <circle
      cx={x}
      cy={y}
      r="5.5"
      fill={muted ? "var(--muted)" : "var(--accent)"}
      stroke="var(--surface)"
      strokeWidth="2.5"
      // 0.75 and not the 0.55 this started at: measured on the dark theme, a
      // muted pin at 0.55 sits close enough to the grid behind it to read as an
      // artefact rather than as a stop on the route.
      opacity={muted ? 0.75 : 1}
    />
  );
}
