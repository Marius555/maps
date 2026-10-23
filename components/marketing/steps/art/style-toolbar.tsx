import { HERO_PIN_COLORS } from "@/lib/marketing/hero-map";

/** The looks the design drawing cycles through; the first is the ground at rest. */
export const LOOKS = [
  { name: "Mono", ink: "currentColor" },
  { name: "Ocean", ink: "#1c7ed6" },
  { name: "Sand", ink: "#e8590c" },
] as const;

/** The pin colours it cycles through; the first, "by tag", is each pin's own. */
export const PIN_COLORS = [null, "#0ca678", "#d6336c"] as const;

/** Pixel steps between one swatch or chip and the next, for the rings that move along them. */
export const SWATCH_STEP = 30;
export const CHIP_STEP = 22;

const BY_TAG = `conic-gradient(${HERO_PIN_COLORS.cafe} 0 33%, ${HERO_PIN_COLORS.pickup} 0 66%, ${HERO_PIN_COLORS.flagship} 0)`;

/**
 * The map designer, reduced to its two most visible choices: a basemap and the
 * pins' colour. Each row has a ring that the drawing's pass moves along it
 * (`data-art="swatch-ring"`, `"chip-ring"`), and at rest both sit on the first.
 */
export function StyleToolbar() {
  return (
    <div className="map-chrome-panel absolute top-3 left-3 z-10 grid gap-2 rounded-xl px-2.5 py-2 text-[9px] font-semibold tracking-wide text-muted uppercase shadow-sm">
      <div className="grid gap-1">
        <span>Basemap</span>
        <div className="relative flex gap-1.5">
          {LOOKS.map((look, index) => (
            <span
              key={look.name}
              className="h-4 w-6 rounded-[5px] border border-border"
              style={{
                color: index === 0 ? "var(--muted)" : look.ink,
                backgroundColor: index === 0 ? "var(--surface)" : `color-mix(in oklab, ${look.ink} 14%, var(--surface))`,
                backgroundImage: "radial-gradient(currentColor 0.9px, transparent 1.3px)",
                backgroundSize: "4px 4px",
              }}
            />
          ))}
          <span
            data-art="swatch-ring"
            className="absolute -top-[3px] -left-[3px] h-[22px] w-[30px] rounded-[7px] border-2 border-accent"
          />
        </div>
      </div>

      <div className="grid gap-1">
        <span>Pins</span>
        <div className="relative flex gap-2">
          {PIN_COLORS.map((color) => (
            <span
              key={color ?? "tag"}
              className="size-3.5 rounded-full"
              style={{ background: color ?? BY_TAG }}
            />
          ))}
          <span
            data-art="chip-ring"
            className="absolute -top-[3px] -left-[3px] size-5 rounded-full border-2 border-accent"
          />
        </div>
      </div>
    </div>
  );
}
