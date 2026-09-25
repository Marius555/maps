import {
  PALETTE_COLORS,
  PALETTE_COLOR_NAMES,
} from "@/lib/validation/palette";
import type { SnapshotColors } from "@/packages/shared/snapshot";

/**
 * The ready-made colours a `ColorSwatchRow` offers between its first swatch
 * (the field's own answer) and its last (any colour at all).
 *
 * Plain module, no `"use client"`: a constant imported from a client module
 * into a server component is a client reference, not the value (CLAUDE.md).
 *
 * Tailored per token rather than one palette everywhere, because orange is a
 * good accent and a bad panel. The four panel tokens get neutrals that read as
 * a panel, a text colour or a line — two light, two dark, so a dark panel is
 * one press away and not a trip to the wheel.
 */
export type ColorPreset = { color: string; name: string };

/** The accent and the default pin: HeroUI-picker brights, orange excluded — it leads the row. */
export const BRIGHT_PRESETS: readonly ColorPreset[] = [
  { color: "#3b82f6", name: "Blue" },
  { color: "#8b5cf6", name: "Violet" },
  { color: "#f43f5e", name: "Rose" },
  { color: "#10b981", name: "Emerald" },
];

export const TOKEN_PRESETS: Record<
  Exclude<keyof SnapshotColors, "accent">,
  readonly ColorPreset[]
> = {
  surface: [
    { color: "#ffffff", name: "White" },
    { color: "#fdf6ec", name: "Cream" },
    { color: "#1f2937", name: "Charcoal" },
    { color: "#0f172a", name: "Midnight" },
  ],
  foreground: [
    { color: "#111827", name: "Ink" },
    { color: "#1e293b", name: "Slate" },
    { color: "#ffffff", name: "White" },
    { color: "#f1f5f9", name: "Mist" },
  ],
  muted: [
    { color: "#6b7280", name: "Grey" },
    { color: "#64748b", name: "Slate" },
    { color: "#9ca3af", name: "Light grey" },
    { color: "#cbd5e1", name: "Pale slate" },
  ],
  border: [
    { color: "#e5e7eb", name: "Light grey" },
    { color: "#d4d4d8", name: "Zinc" },
    { color: "#374151", name: "Dark grey" },
    { color: "#334155", name: "Dark slate" },
  ],
};

/** A card chip's ground: soft tints, since a chip sits under text. */
export const CHIP_PRESETS: readonly ColorPreset[] = [
  { color: "#f1f5f9", name: "Mist" },
  { color: "#e0f2fe", name: "Sky" },
  { color: "#fce7f3", name: "Blush" },
  { color: "#dcfce7", name: "Mint" },
];

/**
 * Tags, groups, shapes and a pin's fill: the legend palette's first five, which
 * is what `nextPaletteColor` hands out first. A colour it assigned from later
 * in the palette shows on the custom swatch, which is still the truth.
 */
export const PALETTE_PRESETS: readonly ColorPreset[] = PALETTE_COLORS.slice(
  0,
  5,
).map((color) => ({ color, name: PALETTE_COLOR_NAMES[color] }));

/** A pin's ring and glyph: white and ink first, since trim is mostly one of them. */
export const PIN_TRIM_PRESETS: readonly ColorPreset[] = [
  { color: "#ffffff", name: "White" },
  { color: "#111827", name: "Ink" },
  { color: PALETTE_COLORS[0], name: PALETTE_COLOR_NAMES[PALETTE_COLORS[0]] },
  { color: PALETTE_COLORS[3], name: PALETTE_COLOR_NAMES[PALETTE_COLORS[3]] },
];
