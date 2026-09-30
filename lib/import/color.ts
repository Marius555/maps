/**
 * A colour cell from an imported file, as `#rrggbb` — or null when it is not one.
 *
 * Hex only, in the three spellings a spreadsheet actually holds: `#e03131`,
 * `e03131` (the `#` is the first thing Excel's autocorrect and half the CMS
 * exports drop) and the short `#e31`. Stored lowercase and six digits, which is
 * what `hexColorSchema` accepts, so two spellings of one colour compare equal.
 *
 * Colour *names* are refused on purpose. "Red" means a different red in every
 * system that exports it, and a pin that came out a colour nobody picked is
 * worse than one that stayed the theme's with a note on its row saying why.
 */
export function parseHexColor(raw: string): string | null {
  const match = /^#?([0-9a-f]{3}|[0-9a-f]{6})$/i.exec(raw.trim());
  if (!match) return null;

  const digits = match[1].toLowerCase();
  const full =
    digits.length === 3
      ? [...digits].map((digit) => digit + digit).join("")
      : digits;

  return `#${full}`;
}
