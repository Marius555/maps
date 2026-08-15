import { Check } from "lucide-react";

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
 * So: a neutral fill, and a check. The check is what makes it work without colour
 * at all, which matters here more than most places — one of these pickers *is* a
 * row of colours, and "the selected one is tinted" is not a signal you can rely on
 * when every option is a different tint.
 *
 * The transparent border is kept on both branches rather than only on the picked
 * one. It carries no colour either way; it is there so the box is the same size in
 * both states and nothing shifts a pixel when you press it.
 *
 * The focus ring is not incidental. These are plain `<button>`s — see PinTile for
 * why they cannot be HeroUI's — so nothing supplies focus styling for them, and
 * the accent border used to be the only thing a keyboard user could see. Removing
 * it without this would trade one problem for a worse one (§8's quality floor:
 * "visible keyboard focus").
 */
export function pickedTileClass(isPicked: boolean): string {
  return `relative cursor-pointer rounded-lg border border-transparent transition-colors duration-[var(--duration-fast)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--focus)] ${
    isPicked ? "bg-default" : "hover:bg-default"
  }`;
}

/**
 * The check itself. Decoration only — `aria-pressed` on the button is what a
 * screen reader reads, and this would just say it a second time.
 */
export function PickedCheck() {
  return (
    <span
      aria-hidden="true"
      className="absolute end-1 top-1 grid size-4 place-items-center rounded-full bg-foreground text-background"
    >
      <Check className="size-3" />
    </span>
  );
}
