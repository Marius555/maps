import { HERO_PIN_COLORS } from "@/lib/marketing/hero-map";

import type { StagePlace } from "../stage/stage-data";

export type SheetRow = { shop: string; place: StagePlace };

/**
 * The spreadsheet the import drawing pours onto the map: a header and one row
 * per location, each wearing its pin's colour as a dot. `data-row-hl` lights a
 * row while it is imported; `data-row-dot` is where its flying dot leaves from.
 */
export function SheetCard({ rows }: { rows: readonly SheetRow[] }) {
  return (
    <div className="absolute top-1/2 left-[5%] z-10 w-[40%] -translate-y-1/2 overflow-hidden rounded-xl border border-border bg-surface text-[10px] leading-none shadow-md sm:text-[11px]">
      <div className="grid grid-cols-[1fr_auto] gap-2 bg-foreground/[0.04] px-2.5 py-1.5 text-[9px] font-semibold tracking-wide text-muted uppercase">
        <span className="pl-4">Shop</span>
        <span>City</span>
      </div>

      {rows.map((row, index) => (
        <div
          key={row.shop}
          className="relative grid grid-cols-[1fr_auto] items-center gap-2 border-t border-border px-2.5 py-[7px]"
        >
          <span
            data-row-hl={index}
            aria-hidden="true"
            className="absolute inset-0 bg-accent/12"
            style={{ opacity: 0 }}
          />
          <span className="relative flex min-w-0 items-center gap-2">
            <span
              data-row-dot={index}
              className="size-2 shrink-0 rounded-full"
              style={{ backgroundColor: HERO_PIN_COLORS[row.place.kind] }}
            />
            <span className="truncate font-medium text-foreground">{row.shop}</span>
          </span>
          <span className="relative text-muted">{row.place.name}</span>
        </div>
      ))}
    </div>
  );
}
