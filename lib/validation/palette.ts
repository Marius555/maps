/**
 * The app's colour palette: eight distinguishable hexes, chosen once.
 *
 * It lived in `category.schema.ts` while categories were the only thing that
 * needed a colour, and by the time tags absorbed them it was already the palette
 * for pins, groups, shapes and imported geometry — six features reaching into a
 * seventh's schema file for a constant that was never about categories. It is
 * its own module now so retiring a feature cannot take the palette with it.
 *
 * A fixed list rather than a free colour wheel wherever the answer is a *legend*:
 * eight colours anyone can tell apart beats eight shades of the same blue and a
 * map nobody can read. `components/ui/color-picker-field.tsx` is the other case —
 * a brand colour, where a palette we chose is simply the wrong palette.
 */
export const PALETTE_COLORS = [
  "#e8590c",
  "#d6336c",
  "#7048e8",
  "#1c7ed6",
  "#0ca678",
  "#66a80f",
  "#f08c00",
  "#495057",
] as const;

/**
 * A name per swatch.
 *
 * React Aria's ColorSwatchPicker derives one from the value itself, so
 * `SwatchPicker` needs nothing here. The pin studio renders its palette as plain
 * buttons — the swatch there has to sit centred in a carousel slot, which that
 * component's fixed-size items cannot do — and a control picked by eye still owes
 * a screen reader something to say.
 */
export const PALETTE_COLOR_NAMES: Record<(typeof PALETTE_COLORS)[number], string> = {
  "#e8590c": "Orange",
  "#d6336c": "Pink",
  "#7048e8": "Violet",
  "#1c7ed6": "Blue",
  "#0ca678": "Teal",
  "#66a80f": "Lime",
  "#f08c00": "Amber",
  "#495057": "Slate",
};

export const DEFAULT_PALETTE_COLOR = PALETTE_COLORS[0];

/**
 * The next colour that nothing is already wearing, else the cycle.
 *
 * Hoisted out of the four callers that each wrote `COLORS[list.length % 8]`,
 * which is only right while nothing has been deleted: remove the second of three
 * groups and the next one you add comes out the same colour as the third.
 */
export function nextPaletteColor(
  taken: readonly string[],
): (typeof PALETTE_COLORS)[number] {
  const used = new Set(taken.map((color) => color.toLowerCase()));
  const free = PALETTE_COLORS.find((color) => !used.has(color));

  return free ?? PALETTE_COLORS[taken.length % PALETTE_COLORS.length];
}
