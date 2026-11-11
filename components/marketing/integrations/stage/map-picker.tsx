import type { AnimationSequence } from "motion/react";

import { PinGlyph, StageCheck } from "./stage-cursor";

/** Three maps, as an account that has a few would show them. */
const MAPS = [
  { name: "Our shops", count: "48 locations" },
  { name: "Stockists", count: "212 locations" },
  { name: "Pop-up events", count: "9 locations" },
] as const;

/**
 * The "Choose a map" sheet the WordPress button opens on our side: a title,
 * three maps (each row's `data-pick-hl` is its highlight, the first one lit),
 * and an accent **Connect** whose check draws itself once pressed
 * (`data-art="connect"`, `data-art="connect-check"`).
 *
 * Hidden at rest — the finished frame is the map already connected. The
 * wrapper (`data-art="sheet"`) fades; the card inside (`data-art="sheet-card"`)
 * is what rises, so a `backdrop` covering the page underneath does not move
 * with it. Drawn the way the real screen reads, not pixel for pixel: a drawing
 * that copies a UI dates the day the UI changes.
 */
export function MapPicker({ backdrop = false }: { backdrop?: boolean }) {
  return (
    <div data-art="sheet" className="absolute inset-0 z-10 grid place-items-center" style={{ opacity: 0 }}>
      {backdrop ? <div className="absolute inset-0 bg-surface" /> : null}

      <div
        data-art="sheet-card"
        className="relative w-[62%] rounded-lg border border-border bg-surface p-2 shadow-lg"
      >
        <p className="flex items-center gap-1.5 px-1 pb-1.5 text-[9px] leading-none font-semibold text-foreground">
          <PinGlyph />
          Choose a map
        </p>

        {MAPS.map((map, index) => (
          <div
            key={map.name}
            data-pick-row={index}
            className="relative flex items-center gap-1.5 rounded-md px-1.5 py-1"
          >
            <span
              data-pick-hl={index}
              className="absolute inset-0 rounded-md bg-accent/14"
              style={{ opacity: index === 0 ? 1 : 0 }}
            />
            <span className="relative size-2.5 shrink-0 rounded-[3px] bg-foreground/10" />
            <span className="relative flex min-w-0 flex-col gap-0.5 leading-none">
              <span className="truncate text-[8px] font-medium text-foreground">{map.name}</span>
              <span className="truncate text-[7px] text-muted">{map.count}</span>
            </span>
          </div>
        ))}

        <div className="mt-1.5 flex justify-end">
          <span
            data-art="connect"
            className="flex items-center gap-1 rounded-full bg-accent px-2 py-1 text-[8px] leading-none font-semibold text-accent-foreground"
          >
            <StageCheck art="connect-check" className="size-2" />
            Connect
          </span>
        </div>
      </div>
    </div>
  );
}

/**
 * The picker's moves, as sequence segments: light row `to` (from row `from`),
 * then the reset that puts row 0 back and un-draws the check, for after the
 * sheet has gone.
 */
export const pickRow = (from: number, to: number, at: number): AnimationSequence => [
  [`[data-pick-hl="${from}"]`, { opacity: 0 }, { duration: 0.2, at }],
  [`[data-pick-hl="${to}"]`, { opacity: 1 }, { duration: 0.2, at }],
];

export const resetPicker = (lit: number, at: number): AnimationSequence => [
  [`[data-pick-hl="${lit}"]`, { opacity: 0 }, { duration: 0.01, at }],
  ['[data-pick-hl="0"]', { opacity: 1 }, { duration: 0.01, at }],
  ['[data-art="connect-check"]', { pathLength: 0 }, { duration: 0.01, at }],
  ['[data-art="sheet-card"]', { y: 0 }, { duration: 0.01, at }],
];
