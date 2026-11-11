/**
 * The pointer a platform drawing is operated with: the landing page's arrow
 * (steps/art/code-pill.tsx), resting at `left`/`top` of the drawing. Its tip
 * is the box's top-left corner, which is what `cursorTo` in
 * steps/stage/pass-kit.ts aims, and every pass sends it back here.
 *
 * Flat and outside every window: a pointer is on the glass, not in the page.
 */
export function StageCursor({ left, top }: { left: string; top: string }) {
  return (
    <svg
      data-art="cursor"
      aria-hidden="true"
      viewBox="0 0 14 20"
      className="absolute z-30 h-4 w-3 overflow-visible drop-shadow-sm"
      style={{ left, top, transformOrigin: "0 0" }}
    >
      <path
        d="M1 1L1 15L4.6 11.6L7.3 18L9.7 17L7.1 10.8L12 10.8Z"
        fill="var(--surface)"
        stroke="var(--foreground)"
        strokeWidth="1.2"
        strokeLinejoin="round"
      />
    </svg>
  );
}

/** Our mark at label size: an accent dot in a soft ring, as the editor's pins are. */
export function PinGlyph({ className = "" }: { className?: string }) {
  return (
    <span
      aria-hidden="true"
      className={`inline-block size-2 shrink-0 rounded-full bg-accent ring-[3px] ring-accent/20 ${className}`}
    />
  );
}

/** An accent check that draws itself (`pathLength`), for Connect, Publish and Active. */
export function StageCheck({ art, className = "size-2.5" }: { art: string; className?: string }) {
  return (
    <svg viewBox="0 0 16 16" className={className} fill="none" aria-hidden="true">
      <path
        data-art={art}
        d="M3.5 8.5l3 3l6-7"
        stroke="currentColor"
        strokeWidth="2.4"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
