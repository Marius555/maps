import { PALETTE_COLORS, PALETTE_COLOR_NAMES } from "@/lib/validation/palette";

/**
 * The colours offered for a pin's ring and its icon.
 *
 * The category palette with white and near-black in front of it. Those two are
 * first because they are the answer almost every time — a ring exists to separate
 * the pin from whatever is under it, and a coloured ring only does that when the
 * fill is close to the map. The eight behind them are there for the brand that
 * wants its ring in its second colour, which is a real request and a rare one.
 *
 * Reusing the category palette rather than opening a colour wheel, for the same
 * reason categories don't get one: eight distinguishable colours chosen once beats
 * eight shades of the same blue and an unreadable map.
 *
 * Neither of these is the *default*. Absent is the default, and absent means the
 * renderer's own — `--accent-foreground` in the dashboard, which follows the light
 * and dark themes, and white in the embed. A stored `#ffffff` cannot do that, so
 * "Auto" is a distinct choice from "White" rather than a nicer name for it.
 */
export const PIN_TRIM_COLORS = ["#ffffff", "#111827", ...PALETTE_COLORS] as const;

export const PIN_TRIM_COLOR_NAMES: Record<string, string> = {
  "#ffffff": "White",
  "#111827": "Ink",
  ...PALETTE_COLOR_NAMES,
};
