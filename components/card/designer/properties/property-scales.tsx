import type { ReactNode } from "react";

/**
 * Every named amount the designer's numeric controls offer.
 *
 * One file, because the same question is asked in several places and two tables
 * of "how thick is a border" would be two panels that disagree — the card's own
 * Border width and the button's are the same five words here, and the card's
 * Corners and the button's are the same five tiles.
 *
 * **Five, and named rather than numbered.** These were sliders; the Corners
 * control became tiles first and its own note is the whole argument, so it is
 * made once here rather than at each table: a number between 0 and 28 is not
 * what anyone is choosing. They are choosing a shape, or an amount of room, and
 * the vocabulary for that is small. A slider also cannot say *zero* — a thumb at
 * the far left of a track reads as "not set" — which is how the corner control
 * ended up unable to express the one thing a corner control exists to say.
 *
 * Every stop is inside the matching range in `CARD_LIMITS`, and the default a
 * fresh block or card carries sits *on* a stop wherever there is one, so an
 * untouched design lights the tile it is actually drawing rather than the
 * nearest approximation (`nearestStop` in lib/card/scale-stops.ts).
 */

/** What a scale's tiles are: a stored number and the word for it. */
export type ScaleOption = {
  value: number;
  label: string;
  icon?: ReactNode;
};

/**
 * The five corners, as tiles that draw their own corner.
 *
 * **The icons are not lucide.** A radius is hard to say with a glyph and trivial
 * to say with the thing itself, so each tile is a bordered square wearing the
 * radius it stands for.
 *
 * `8` is the button stylesheet's own `0.5rem` and `12` is `defaultCardLayout`'s,
 * so both an unstyled button and an untouched card show the tile they are
 * actually drawing. The preview square is 14px and a radius is clamped to half
 * its own box, so the icon is spread across that half rather than wearing the
 * stored number — which would draw Round and Pill as the same circle.
 */
export const RADIUS_STOPS: readonly ScaleOption[] = [
  { value: 0, label: "Square" },
  { value: 8, label: "Rounded" },
  { value: 12, label: "Soft" },
  { value: 20, label: "Round" },
  { value: 28, label: "Pill" },
].map((option, index, all) => ({
  ...option,
  icon: (
    <span
      aria-hidden="true"
      className="size-3.5 border-2 border-current"
      style={{
        borderRadius: `${String((index / (all.length - 1)) * 7)}px`,
      }}
    />
  ),
}));

/**
 * How thick an outline is, for the card and for a button — both capped at 6.
 *
 * Not a straight fifth of the range: one pixel is a hairline and is the width
 * most outlines want, so it gets a tile of its own and the spacing opens up at
 * the thick end where a pixel matters less.
 */
export const BORDER_WIDTHS: readonly ScaleOption[] = [
  { value: 0, label: "None" },
  { value: 1, label: "Hairline" },
  { value: 2, label: "Thin" },
  { value: 4, label: "Medium" },
  { value: 6, label: "Thick" },
];

/** The same five, for a chip — whose outline is capped at 4 (`CARD_LIMITS`). */
export const CHIP_BORDER_WIDTHS: readonly ScaleOption[] = [
  { value: 0, label: "None" },
  { value: 1, label: "Hairline" },
  { value: 2, label: "Thin" },
  { value: 3, label: "Medium" },
  { value: 4, label: "Thick" },
];

/** The words every amount-of-room control uses, whatever its own ceiling is. */
const ROOM_LABELS = ["None", "Tight", "Regular", "Roomy", "Wide"] as const;

function room(
  stops: readonly [number, number, number, number, number],
): readonly ScaleOption[] {
  return stops.map((value, index) => ({ value, label: ROOM_LABELS[index] }));
}

/** Room inside a button, on top of what it already has. Capped at 14. */
export const BUTTON_ROOM: readonly ScaleOption[] = room([0, 3, 6, 10, 14]);

/** Room inside a chip. Capped at 10, and paid on every chip a location wears. */
export const CHIP_ROOM: readonly ScaleOption[] = room([0, 2, 4, 7, 10]);

/** The card's own padding. 12 is `defaultCardLayout`'s. */
export const CARD_PADDING: readonly ScaleOption[] = room([0, 6, 12, 20, 28]);

/** The space between two blocks. 8 is `defaultCardLayout`'s. */
export const CARD_GAP: readonly ScaleOption[] = room([0, 4, 8, 14, 20]);

/** A block's own padding. 4 is what `TEXT_PADDING` gives a fresh text block. */
export const BLOCK_PADDING: readonly ScaleOption[] = room([0, 4, 8, 16, 24]);

/**
 * A block's own margin. 12 is the card's default padding, which is where an
 * untouched block sits (`defaultMarginOf`).
 */
export const BLOCK_MARGIN: readonly ScaleOption[] = room([0, 6, 12, 20, 28]);

/**
 * The space between two days of the week. 1 is `DEFAULT_HOURS_ROW_GAP`, which is
 * what the embed's list draws and what `resizeCardBlock` stores nothing for.
 */
export const HOURS_GAP: readonly ScaleOption[] = room([0, 1, 4, 8, 12]);

/**
 * The type size, whose first tile is not a size at all.
 *
 * Zero is "leave this block's own size alone", which is what every card that has
 * never been through this control stores. It was the slider's lowest position,
 * one below the real minimum, printing "Default" instead of a number — a
 * sentinel that only worked because it sat off the end of the track. As a tile
 * it is simply the first choice, which is what it always meant.
 */
export const FONT_SIZES: readonly ScaleOption[] = [
  { value: 0, label: "Default" },
  { value: 12, label: "S" },
  { value: 16, label: "M" },
  { value: 22, label: "L" },
  { value: 28, label: "XL" },
];

/** How wide the card is. 320 is `defaultCardLayout`'s. */
export const CARD_WIDTHS: readonly ScaleOption[] = [
  { value: 220, label: "XS" },
  { value: 270, label: "S" },
  { value: 320, label: "M" },
  { value: 400, label: "L" },
  { value: 480, label: "XL" },
];

/** How tall the card may get. 440 is `defaultCardLayout`'s. */
export const CARD_HEIGHTS: readonly ScaleOption[] = [
  { value: 180, label: "XS" },
  { value: 300, label: "S" },
  { value: 440, label: "M" },
  { value: 580, label: "L" },
  { value: 720, label: "XL" },
];

/**
 * How much of the card's ground is painted, and the results panel's own words.
 *
 * The same five stops as `OPACITIES` in
 * components/publish/design-sidebar/panel-group.tsx, deliberately: an owner
 * makes a panel see-through on one screen and a card see-through on another,
 * and two tables of different numbers under one word would be two features
 * wearing one name. Stored as opacity and labelled as transparency, which is
 * the way round somebody looking at a see-through card describes it.
 *
 * `100` sits on the stop `nearestStop` lights for a card that has never been
 * touched, and writing it clears the field rather than storing it — see
 * `CardProperties`.
 */
export const CARD_OPACITIES: readonly ScaleOption[] = [
  { value: 100, label: "Solid" },
  { value: 94, label: "Faint" },
  { value: 88, label: "Light" },
  { value: 76, label: "Clear" },
  { value: 60, label: "Glass" },
];

/**
 * Three, not five, and the panel's own three.
 *
 * Blur is a background effect nobody is choosing 16px of, and this control is
 * only ever on screen for a card that is already see-through — so the question
 * it answers is "a little or a lot", not a number.
 */
export const CARD_BLURS: readonly ScaleOption[] = [
  { value: 0, label: "None" },
  { value: 10, label: "Soft" },
  { value: 20, label: "Strong" },
];

/**
 * A share of the line, as a percentage.
 *
 * Labelled with the number, because that is what someone is choosing here: a
 * quarter, a third, a half. The floor varies by block type (`minWidthPct`), so
 * the narrow end is dropped rather than offered and then refused — every stop a
 * control shows has to be one the save will keep.
 */
export function widthStops(minPct: number): readonly ScaleOption[] {
  return [25, 33, 50, 75, 100]
    .filter((value) => value >= minPct)
    .map((value) => ({ value, label: `${String(value)}%` }));
}

/** How far a mark is pulled over the block beside it. 50 is a logo's default. */
export const OVERLAP_STOPS: readonly ScaleOption[] = [
  { value: 0, label: "0%" },
  { value: 25, label: "25%" },
  { value: 50, label: "50%" },
  { value: 75, label: "75%" },
  { value: 100, label: "100%" },
];

/**
 * How tall a block is, as a share of the card — built around its own default
 * rather than by cutting its range into five.
 *
 * The three types with a height each have a different ceiling and a different
 * natural size (a gallery is a quarter of the card, a spacer is 6% of it), so a
 * fifth of the range would put every one of those defaults *between* two tiles
 * and a fresh block would light one it is not drawing. The default is therefore
 * the middle stop, with two below it and the ceiling above.
 */
export function heightStops(
  defaultPct: number,
  maxPct: number,
): readonly ScaleOption[] {
  const middle = defaultPct > 0 ? defaultPct : Math.round(maxPct / 2);
  const labels = ["XS", "S", "M", "L", "XL"];

  return [
    Math.max(1, Math.round(middle * 0.4)),
    Math.max(1, Math.round(middle * 0.7)),
    middle,
    Math.round((middle + maxPct) / 2),
    maxPct,
  ].map((value, index) => ({ value, label: labels[index] }));
}

/**
 * How many lines of a description are kept before it is clipped.
 *
 * Six tiles rather than five, which the ceiling allows: that ceiling is about how
 * wide a *word* is (see `PropertyChoice`), and these are one digit each.
 */
export const CLAMP_LINES: readonly ScaleOption[] = [1, 2, 3, 4, 5, 6].map(
  (value) => ({ value, label: String(value) }),
);
