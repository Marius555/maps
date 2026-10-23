/**
 * The one line, with the copy button the pass presses and the cursor that
 * presses it. Foreground on background, so it is the darkest thing on a light
 * page and the lightest on a dark one. `data-art="code"` is typed out by an
 * animated clip; `"check"` draws itself.
 */
export function CodePill() {
  return (
    <div
      data-art="pill"
      className="absolute bottom-[6%] left-1/2 z-10 flex h-8 w-[80%] -translate-x-1/2 items-center gap-2 rounded-full bg-foreground pr-1 pl-3.5 font-mono text-[10px] text-background shadow-lg"
    >
      <span data-art="code" className="min-w-0 flex-1 truncate" style={{ clipPath: "inset(0% 0% 0% 0%)" }}>
        {'<script src="…/map.js"></script>'}
      </span>

      <span data-art="copy" className="relative grid size-6 shrink-0 place-items-center rounded-full bg-accent">
        <svg viewBox="0 0 16 16" className="size-3.5" fill="none">
          <path
            data-art="check"
            d="M3.5 8.5l3 3l6-7"
            stroke="var(--accent-foreground)"
            strokeWidth="2.2"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>

        {/* The cursor, resting on the button. */}
        <svg
          data-art="cursor"
          viewBox="0 0 14 20"
          className="absolute top-3 left-3 h-4 w-3 overflow-visible drop-shadow-sm"
        >
          <path
            d="M1 1L1 15L4.6 11.6L7.3 18L9.7 17L7.1 10.8L12 10.8Z"
            fill="var(--surface)"
            stroke="var(--foreground)"
            strokeWidth="1.2"
            strokeLinejoin="round"
          />
        </svg>
      </span>
    </div>
  );
}
