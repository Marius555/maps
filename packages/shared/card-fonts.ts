/**
 * The typefaces a card block may be set in.
 *
 * Here rather than in /lib for the reason `card-layout.ts` is (CLAUDE.md §4):
 * three things draw a card and all three have to resolve "Georgia" to the same
 * pixels. Zero dependencies, vanilla TS, as that rule requires.
 *
 * **Only faces the visitor's machine already has.** A webfont is a request in
 * the visitor's path on a stranger's website — a third-party origin their own
 * CSP can block, a flash of unstyled text on a slow phone, and, for a Google
 * Fonts URL, a privacy problem a customer would inherit from us. §2 is about
 * cost per view and this is the same argument one step out: a card that costs a
 * visitor nothing is the product. Every stack below therefore names real
 * families and ends in a generic keyword, so the worst case is a face that is
 * merely not the first choice rather than a card drawn in the wrong thing.
 *
 * **What is stored is the `stack`, not the `id`.** Same argument §0 makes about
 * publishing a resolved tint rather than a theme's name: a snapshot is read
 * forever by sites we do not control, so a key would be a promise that renaming
 * a catalogue entry breaks. It also keeps this list out of the embed — the embed
 * applies a string and never needs the catalogue.
 *
 * **A stack string that has shipped is permanent.** `isCardFont` is what the
 * resolver and the schema both check against, and a stack edited here stops
 * validating on every row and every snapshot already carrying it — which would
 * silently drop the font from cards that are live. Add an entry, never rewrite
 * one.
 */

export type CardFont = {
  /** Stable within this file only; never stored. */
  id: string;
  /** What the picker calls it. */
  label: string;
  /** The `font-family` value, and the thing that is stored. */
  stack: string;
};

export const CARD_FONTS: readonly CardFont[] = [
  {
    id: "sans",
    label: "Sans",
    stack:
      'ui-sans-serif, system-ui, -apple-system, "Segoe UI", Roboto, Arial, sans-serif',
  },
  {
    id: "serif",
    label: "Serif",
    stack: 'Georgia, "Times New Roman", Times, serif',
  },
  {
    id: "grotesk",
    label: "Grotesk",
    stack: '"Helvetica Neue", Helvetica, Arial, sans-serif',
  },
  {
    id: "humanist",
    label: "Humanist",
    stack: '"Trebuchet MS", "Segoe UI", Tahoma, sans-serif',
  },
  {
    id: "wide",
    label: "Wide",
    stack: 'Verdana, Geneva, "DejaVu Sans", sans-serif',
  },
  {
    id: "mono",
    label: "Mono",
    stack:
      'ui-monospace, SFMono-Regular, Menlo, Consolas, "Liberation Mono", monospace',
  },
];

/**
 * Whether this is a stack we published.
 *
 * Exact membership rather than a character-class regex, and that is the security
 * half of the decision. A `font-family` built from customer input and written
 * inline on a third party's page is an injection surface — a closing quote, a
 * `url()`, a stray semicolon — and the embed writes exactly that
 * (`wrapBlock` in embed/src/popup.ts). A closed list makes the whole class of
 * problem unreachable instead of merely unlikely.
 */
export function isCardFont(stack: unknown): stack is string {
  return (
    typeof stack === "string" &&
    CARD_FONTS.some((font) => font.stack === stack)
  );
}

/** The catalogue entry for a stored stack, for a picker that has to show a name. */
export function cardFontOf(stack: string | undefined): CardFont | undefined {
  return stack ? CARD_FONTS.find((font) => font.stack === stack) : undefined;
}
