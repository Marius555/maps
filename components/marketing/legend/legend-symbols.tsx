/**
 * The symbols in the key.
 *
 * Drawn rather than taken from an icon set, because a legend's job is to
 * explain *this* map's marks — and these are this map's marks: the ball the
 * embed draws for a pin, the bubble it draws for a cluster, the glass column it
 * draws for the results panel, the dashed ring it draws for an area. A row of
 * generic outline icons would be decoration standing where information goes.
 *
 * Every colour is a theme token, so the key crossfades with the page.
 */

const STROKE = { fill: "none", strokeWidth: 1.6, strokeLinecap: "round" } as const;

function Frame({ children }: { children: React.ReactNode }) {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 32 32"
      className="size-8 shrink-0"
      strokeLinejoin="round"
    >
      {children}
    </svg>
  );
}

export function SearchSymbol() {
  return (
    <Frame>
      <circle cx="14" cy="14" r="7.5" stroke="var(--muted)" {...STROKE} />
      <path d="M19.5 19.5L26 26" stroke="var(--accent)" {...STROKE} strokeWidth="2" />
      <path d="M10 12.5h8M10 16h5" stroke="var(--muted)" {...STROKE} opacity="0.7" />
    </Frame>
  );
}

export function NearestSymbol() {
  return (
    <Frame>
      <circle cx="16" cy="16" r="9" stroke="var(--muted)" {...STROKE} />
      <path d="M16 3v5M16 24v5M3 16h5M24 16h5" stroke="var(--muted)" {...STROKE} />
      <circle cx="16" cy="16" r="3.5" fill="var(--accent)" />
    </Frame>
  );
}

/**
 * Pins gathered into one.
 *
 * Three overlapping balls with a ring of the page between them, rather than a
 * ball inside a translucent halo: an accent wash at the 0.18 it started on is
 * simply not there against the dark theme's near-black ground, and the symbol
 * read as one dot with two specks beside it. Overlap says "several, stacked"
 * in both themes and at any opacity.
 */
export function ClusterSymbol() {
  return (
    <Frame>
      <circle cx="21" cy="9" r="5" fill="var(--muted)" stroke="var(--background)" strokeWidth="2" />
      <circle cx="10" cy="11" r="4" fill="var(--muted)" stroke="var(--background)" strokeWidth="2" />
      <circle cx="16" cy="21" r="9" fill="var(--accent)" stroke="var(--background)" strokeWidth="2" />
    </Frame>
  );
}

export function CardSymbol() {
  return (
    <Frame>
      <rect x="9" y="4" width="21" height="24" rx="4" stroke="var(--muted)" {...STROKE} />
      <rect x="12" y="7" width="15" height="7" rx="2" fill="var(--muted)" opacity="0.35" />
      <path d="M12 18.5h11M12 22h7" stroke="var(--muted)" {...STROKE} />
      <circle cx="5" cy="16" r="3.5" fill="var(--accent)" stroke="var(--surface)" strokeWidth="1.5" />
    </Frame>
  );
}

export function PanelSymbol() {
  return (
    <Frame>
      <rect x="2" y="6" width="28" height="20" rx="3.5" stroke="var(--muted)" {...STROKE} />
      {/* `fillOpacity`, never a whole-element `opacity`: the latter dims the
          stroke with the fill, and a 16%-of-accent wash is invisible on the
          dark theme's ground. */}
      <rect x="18" y="8.5" width="9.5" height="15" rx="2.5" fill="var(--accent)" fillOpacity="0.28" />
      <path d="M20.5 12.5h4.5M20.5 16h4.5M20.5 19.5h3" stroke="var(--accent)" {...STROKE} />
      <circle cx="9" cy="14" r="2.5" fill="var(--muted)" opacity="0.8" />
      <circle cx="13" cy="20" r="2" fill="var(--muted)" opacity="0.5" />
    </Frame>
  );
}

export function FilterSymbol() {
  return (
    <Frame>
      <rect x="2" y="7" width="15" height="8" rx="4" fill="var(--accent)" opacity="0.2" />
      <rect x="2" y="7" width="15" height="8" rx="4" stroke="var(--accent)" {...STROKE} />
      <rect x="10" y="18" width="20" height="8" rx="4" stroke="var(--muted)" {...STROKE} />
      <rect x="20" y="5" width="10" height="8" rx="4" stroke="var(--muted)" {...STROKE} />
    </Frame>
  );
}

export function AreaSymbol() {
  return (
    <Frame>
      {/* The ring has to stay solid while the fill stays faint, so the two
          opacities are separate. A single `opacity` on the element dimmed the
          dashes into the ground and left a smudge where a drawn area should
          be. */}
      <circle
        cx="12"
        cy="17"
        r="10"
        fill="var(--accent)"
        fillOpacity="0.16"
        stroke="var(--accent)"
        strokeWidth="1.6"
        strokeDasharray="3 3"
      />
      <path
        d="M6 28C13 26 17 15 23 10.5C25 9 27.5 8 29 7.5"
        stroke="var(--accent)"
        {...STROKE}
        strokeWidth="2"
      />
      <circle cx="29" cy="7" r="2.5" fill="var(--accent)" />
    </Frame>
  );
}
