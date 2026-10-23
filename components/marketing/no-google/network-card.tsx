/**
 * What a published map loads, in order, and the one thing it never does. The
 * hosts are the real ones (CLAUDE.md §0: R2 behind cdn.pinglide.com, tiles on
 * OpenFreeMap) — this is a picture of a network panel, not a metaphor for one.
 */
export const REQUESTS = [
  { file: "map.js", host: "cdn.pinglide.com" },
  { file: "your-map.json", host: "cdn.pinglide.com" },
  { file: "tiles.pbf", host: "openfreemap.org" },
] as const;

/**
 * The browser's network panel beside the map, in the shape of the import
 * drawing's spreadsheet (steps/art/sheet-card.tsx): a header, a row per
 * request with its check, and Google's row last — dashed, empty, struck
 * through, because that request never happens. It sits on the right, clear of
 * the pins, which stand in the west of the ground.
 *
 * The `data-*` hooks are what the drawing's pass selects: `data-req-hl` lights
 * a row while its request is in flight, `data-req-target` is where the flying
 * dot lands, `data-check` draws the tick and `data-art="strike"` the line
 * through Google's host.
 */
export function NetworkCard() {
  return (
    <div className="absolute top-1/2 right-[3%] z-10 w-[44%] -translate-y-1/2 overflow-hidden rounded-xl border border-border bg-surface text-[9px] leading-none shadow-md sm:text-[10px]">
      <div className="flex items-center justify-between gap-2 bg-foreground/[0.04] px-2.5 py-1.5 text-[8px] font-semibold tracking-wide text-muted uppercase sm:text-[9px]">
        <span>Network</span>
        <span className="font-mono normal-case">{REQUESTS.length} requests</span>
      </div>

      {REQUESTS.map((request, index) => (
        <div
          key={request.file}
          className="relative flex items-center justify-between gap-2 border-t border-border px-2.5 py-[6px] sm:py-[7px]"
        >
          <span
            data-req-hl={index}
            aria-hidden="true"
            className="absolute inset-0 bg-accent/12"
            style={{ opacity: 0 }}
          />
          <span className="relative min-w-0 font-mono">
            <span className="block truncate text-foreground">{request.file}</span>
            <span className="mt-1 block truncate text-muted">{request.host}</span>
          </span>
          <span
            data-req-target={index}
            className="relative grid size-4 shrink-0 place-items-center rounded-full bg-accent"
          >
            <svg viewBox="0 0 16 16" className="size-4" fill="none">
              <path
                data-check={index}
                d="M4.5 8.5l2.4 2.4l4.6-5"
                stroke="var(--accent-foreground)"
                strokeWidth="1.8"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </span>
        </div>
      ))}

      <GoogleRow />
    </div>
  );
}

function GoogleRow() {
  return (
    <div className="border-t border-border p-1.5">
      <div className="flex items-center justify-between gap-2 rounded-lg border border-dashed border-muted/50 px-1.5 py-[5px]">
        <span className="min-w-0 font-mono text-muted">
          <span className="relative block w-fit max-w-full truncate">
            maps.googleapis.com
            <span
              data-art="strike"
              aria-hidden="true"
              className="absolute inset-x-[-2px] top-1/2 h-[1.5px] origin-left rounded-full bg-accent"
            />
          </span>
          <span className="mt-1 block truncate opacity-80">never requested</span>
        </span>
        <span
          data-art="never"
          className="grid size-4 shrink-0 place-items-center rounded-full border border-dashed border-muted/60 text-muted"
        >
          <svg viewBox="0 0 16 16" className="size-3" fill="none">
            <path d="M5 5l6 6M11 5l-6 6" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
          </svg>
        </span>
      </div>
    </div>
  );
}
