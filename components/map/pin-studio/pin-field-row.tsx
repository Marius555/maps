"use client";

import type { ReactNode } from "react";

import { CarouselTrack } from "@/components/ui/carousel";

/**
 * A label, then its options across the full width of the dialog.
 *
 * The shared shell under every control in the builder, so seven rows read as one
 * form rather than as seven widgets that happen to be stacked.
 *
 * The label is above the options and not beside them, which is what buys the
 * width: a 96px label column on the left is 96px the options do not get, and the
 * options are the part being compared. Above at every breakpoint rather than
 * only on a phone — a row that reflows at `sm` is two layouts to keep working,
 * and the wide one was the one giving ground.
 *
 * Three options across, and the rest reached by scrolling. That is `CarouselTrack`
 * at `columns={3}`, the same scroll container the library's pin rows use — arrows
 * that page it, swipe on touch, and no scrollbar. Three rather than "as many as
 * fit" because these rows are stacked and read down as well as across: a row of
 * three shapes stretched to the full width beside a row of eleven colours crushed
 * to 36px does not look like two of the same control. Nothing here has to know
 * how many options it has: the track measures whether it overflows and shows its
 * arrows accordingly.
 *
 * `role="group"` and not `radiogroup`: React Aria owns roving focus for a real
 * radio group, and these are plain `<button>`s (see PinTile for why they cannot
 * be HeroUI's). A group with a name, and `aria-pressed` on each button, is the
 * honest description of what is actually there — which is also why the track is
 * a `div` here and a `ul` in the library. A list of controls is not a list.
 */
export function PinFieldRow({
  label,
  count,
  children,
}: {
  label: string;
  /** Options in the row, so the track knows when to re-measure. */
  count: number;
  children: ReactNode;
}) {
  return (
    <div role="group" aria-label={label} className="flex flex-col gap-1">
      <span className="text-sm font-medium">{label}</span>

      <CarouselTrack label={label} count={count} columns={3} as="div">
        {children}
      </CarouselTrack>
    </div>
  );
}
