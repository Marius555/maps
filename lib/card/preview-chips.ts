import type { TagChip } from "@/packages/shared/tags";

/**
 * How many chips the designer's sample card is drawn with.
 *
 * **Designer-only, and it never leaves the page.** It is not a field on a block,
 * not a key in the layout and not a byte in a published snapshot — it sits in
 * `CardDesigner`'s own state beside `sampleImageUrl`, for that field's reason: a
 * real card shows every tag its location wears, and a control that quietly
 * changed that would be a preview gesture editing the design (CLAUDE.md §7).
 *
 * It exists because the Tags block is the one block whose height varies with the
 * *location* rather than with its words, and the sample the canvas draws is
 * whatever the first location in the map happens to be tagged with. A layout
 * arranged against a shop wearing one tag falls apart on the stockist wearing
 * six, and until now there was no way to find that out except by publishing.
 *
 * Here rather than in `packages/shared` because nothing outside the dashboard
 * may ever call it — the embed has no sample and no designer — and here rather
 * than inline in the component because the padding rule is the part worth
 * testing, exactly as `drop-action.ts` and `edge-autoscroll.ts` are.
 */

/** What the control offers. `null` is the sample's own tags, untouched. */
export const CHIP_PREVIEW_COUNTS: readonly number[] = [1, 2, 3, 4, 6];

/**
 * Labels for chips the sample location does not actually have.
 *
 * Deliberately uneven in length, because the thing being previewed is *wrapping*
 * — a row of six identical four-letter pills wraps at a place no real vocabulary
 * ever would, and a layout checked against that is a layout checked against
 * nothing. Cycled rather than exhausted, so a count past this list still varies.
 */
const SAMPLE_LABELS: readonly string[] = [
  "Bikes",
  "Open Sundays",
  "Repairs",
  "Click & collect",
  "Ski hire",
  "Wheelchair access",
];

/**
 * The sample's tags, trimmed or padded to `count`.
 *
 * `null` returns the input **by reference**, so the untouched path costs nothing
 * and a card nobody is previewing at a count is drawn from exactly the data it
 * was before this existed.
 *
 * Padding keeps the real chips first and in their own order, which matters for
 * more than tidiness: the location's first tag is what colours its pin, and a
 * synthetic chip pushed to the front would draw the sample card against a colour
 * the map does not use. The invented ids carry a prefix no `newTagId` can mint,
 * so nothing downstream can mistake one for a tag the map defines.
 */
export function previewChips(
  real: readonly TagChip[],
  count: number | null,
): readonly TagChip[] {
  if (count === null) return real;
  if (count <= real.length) return real.slice(0, count);

  /*
   * The stand-ins, minus anything the location already wears.
   *
   * Without this the preview happily draws "Ski hire" twice on a bike shop that
   * genuinely has a Ski hire tag, and a duplicate chip reads as a bug in the tag
   * system rather than as a placeholder — which is the opposite of what a
   * preview is for. Matched case-insensitively, because a vocabulary is typed by
   * hand and "Repairs" and "repairs" are the same word to whoever is looking.
   */
  const worn = new Set(real.map((chip) => chip.label.toLowerCase()));
  const spare = SAMPLE_LABELS.filter((label) => !worn.has(label.toLowerCase()));

  const padded = [...real];
  for (let index = real.length; index < count; index += 1) {
    const spareIndex = index - real.length;

    padded.push({
      id: `preview-${String(index)}`,
      // Numbered once the list runs out, which is the honest thing to draw: a
      // cycle would start repeating, and repeating is what this avoids.
      label:
        spare[spareIndex] ?? `Tag ${String(spareIndex - spare.length + 1)}`,
      // No colour: the pin's colour is the *real* first tag's, and inventing one
      // here would paint the sample pin a colour the map has never heard of.
    });
  }

  return padded;
}
