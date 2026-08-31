/**
 * The one "this is the one you picked" treatment, for the pin pickers.
 *
 * It used to be `border-accent bg-accent-soft`, written out three times. Vermilion
 * is the app's only accent and it belongs on the controls that *do* something —
 * spending it on the swatch you are already looking at put three pickers in
 * competition with the Save button beside them. In the colour carousel it was
 * worse than redundant: an accent ring drawn around a coloured circle asks the eye
 * to read two unrelated colours as one object.
 *
 * So: a neutral fill, and nothing else. A black check badge sat in the corner of
 * the picked tile for a while, on the argument that a tint is not a signal you
 * can rely on in a row where every option is a tint. That argument holds for the
 * colour swatches, which is why those still carry a tick of their own *inside*
 * the circle — but on a 56px tile the fill is plenty, and a badge on every picker
 * in a seven-row form is seven small black dots competing with the pins.
 *
 * The transparent border is kept on both branches rather than only on the picked
 * one. It carries no colour either way; it is there so the box is the same size in
 * both states and nothing shifts a pixel when you press it.
 *
 * The focus ring is not incidental. These are plain `<button>`s — see PinTile for
 * why they cannot be HeroUI's — so nothing supplies focus styling for them, and
 * the accent border used to be the only thing a keyboard user could see. Removing
 * it without this would trade one problem for a worse one (§8's quality floor:
 * "visible keyboard focus"), and with the check gone it is the only state a
 * keyboard user has left.
 *
 * The focus ring survives `isDisabled` for that same reason. These tiles are
 * `aria-disabled` rather than natively disabled — they stay in the tab order so
 * that the sentence explaining why they are off is reachable without a pointer —
 * and a focusable control with no focus ring is the worse half of that trade.
 */
export function pickedTileClass(isPicked: boolean, isDisabled = false): string {
  const base =
    "relative rounded-lg border border-transparent transition-colors duration-[var(--duration-fast)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--focus)]";

  /*
   * A disabled tile wears the hover fill, permanently.
   *
   * `bg-default` is what this tile looks like under the pointer and what it
   * looks like once picked, so spending it on "off" as well sounds like a
   * collision and is not: a tile that cannot be pressed never reaches the hover
   * state, and a tile that cannot be pressed cannot be the picked one either.
   * What the fill buys is a *plate* — the grey pin sitting on it now has a
   * surface to be a lighter grey than, which is the whole reason a drained pin
   * on a bare popover read as a rendering fault rather than as a disabled
   * control.
   *
   * The hover and the cursor are *omitted* here rather than overridden by the
   * caller. Two utilities setting the same property have equal specificity, so
   * which one wins is decided by their order in Tailwind's generated stylesheet
   * — not by the order they appear in a class string. `hover:bg-transparent`
   * after `hover:bg-default` therefore reads as a fix and behaves as a coin
   * toss. Not emitting the rule is the only version that cannot flip.
   */
  if (isDisabled) return `${base} cursor-not-allowed bg-default`;

  return `${base} cursor-pointer ${isPicked ? "bg-default" : "hover:bg-default"}`;
}
