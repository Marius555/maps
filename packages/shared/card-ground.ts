/**
 * Which light/dark a card's *text* should be drawn in, asked of the card's own
 * ground rather than of the map underneath it.
 *
 * **The bug this exists for.** A card's colour context has always come from the
 * basemap — `cardThemeClass` on the dashboard, `.lm-root--dark` in the embed —
 * on the sound reasoning that the studio should preview what a visitor gets. But
 * the *ground* is a colour its owner pinned (`CardLayout.background`), and a
 * pinned colour cannot follow a theme. Pin white, switch the map to a dark
 * basemap, and the card keeps its white ground while every word on it turns
 * near-white. Measured on a real design: a `#ffffff` ground at 60% over a dark
 * map resolves to about `#a3a3a3`, and the address on it is `--muted`, `#989898`.
 * The same colour, give or take. The only legible thing left was a button, whose
 * background is a literal too.
 *
 * Both renderers had it, identically — which is what the twin-renderer rule is
 * supposed to guarantee, and here guaranteed the same defect twice. So the fix
 * is one function they both call rather than two that agree today.
 *
 * **The rule.** A pinned ground decides; the basemap decides when nothing was
 * pinned. That second half is today's behaviour and is left exactly as it was,
 * which is what keeps every card that never touched the Background control
 * rendering byte-for-byte as before.
 *
 * **Translucency is composited, not ignored.** A ground at 60% is only 60% the
 * owner's colour and 40% whatever is behind it, and at low enough opacity the
 * map wins the argument — a 10% white veil over a dark basemap is still a dark
 * card and still wants pale text. So the mix is done before the question is
 * asked. OKLab's L is perceptual and `color-mix(in oklab, …)` is the very
 * function `cardGround` uses to paint this, so mixing the two lightnesses in the
 * same space is the arithmetic the browser is about to do anyway.
 *
 * **What is behind the card is the map, not a panel.** The two constants below
 * stand in for "a dark basemap" and "a light one". They do not have to match any
 * particular tile style — they are one side or the other of a threshold, and a
 * basemap dark enough to be called dark is nowhere near 0.5.
 *
 * Lives here, not in /lib, because the embed is the other half of the pair —
 * and it costs the bundle almost nothing, since `parseColor` and `lightnessOf`
 * are already in it via `loadMapStyle` → `map-appearance` → `style-tint`
 * (CLAUDE.md §4).
 */

import { lightnessOf, parseColor } from "./color";

/**
 * OKLab L of a representative dark basemap, and of a light one.
 *
 * Only ever used as the far end of a mix, so precision past "clearly dark" and
 * "clearly light" buys nothing.
 */
const BEHIND_DARK_L = 0.15;
const BEHIND_LIGHT_L = 0.98;

/**
 * The midpoint, and deliberately the obvious one.
 *
 * A ground exactly here is unreadable in both directions, so there is no clever
 * value that rescues it; what matters is that the two sides of it are the two
 * token sets, and that the answer does not wobble between the renderers.
 */
const LIGHT_THRESHOLD = 0.5;

/** Just the parts of a layout this asks about. */
export type CardGroundInput = {
  background?: string;
  backgroundOpacity?: number;
};

/**
 * Whether this card's ground disagrees with the map under it — that is, whether
 * the card wants the *opposite* palette to the one the basemap asked for.
 *
 * False whenever the ground is not the card's to answer for: nothing pinned, or
 * a colour notation `parseColor` does not read. False is "leave it to the
 * basemap", which is what every caller did before this existed, so a card that
 * never touched the Background control is untouched by all of this.
 *
 * A boolean rather than the light/dark itself because that is the question both
 * callers actually have — the embed toggles one class on it, and
 * `cardThemeClass` folds it into the basemap's answer with a single `!==`.
 * Returning a string the two then had to convert cost bytes in the embed for
 * nothing (CLAUDE.md §4).
 *
 * `mapIsDark` is what the basemap would have answered, and is used twice: as the
 * thing a translucent ground is composited over, and as what the result is
 * compared against.
 */
export function cardFlipsTheme(
  layout: CardGroundInput,
  mapIsDark: boolean,
): boolean {
  const ground = layout.background ? parseColor(layout.background) : null;

  if (!ground) return false;

  /*
   * Absent opacity means opaque — the same reading `cardGround` gives it, where
   * an undefined `backgroundOpacity` writes the colour with no mix at all. The
   * colour's *own* alpha counts too: `#ffffff80` is as see-through as 50%.
   *
   * Neither is clamped here. `backgroundOpacity` arrives off `card-layout.ts`,
   * which bounds it to 0–100 before anything can store it, and `parseColor`
   * never returns an alpha outside 0–1. Re-checking would be this file not
   * trusting the schema, which is the thing the schema is for — and it is paid
   * for in bytes on every visitor's download (CLAUDE.md §4).
   */
  const alpha = ((layout.backgroundOpacity ?? 100) / 100) * ground.a;
  const behind = mapIsDark ? BEHIND_DARK_L : BEHIND_LIGHT_L;

  const isLight =
    lightnessOf(ground) * alpha + behind * (1 - alpha) >= LIGHT_THRESHOLD;

  return isLight === mapIsDark;
}
