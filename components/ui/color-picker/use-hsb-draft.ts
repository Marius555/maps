"use client";

import { parseColor, type Color } from "@heroui/react";
import { useState } from "react";

/**
 * What the wheel opens on when nothing is set.
 *
 * **Saturated on purpose, and that is what makes the hue slider work on first
 * use.** Hue means nothing at zero saturation — every hue of a grey is the same
 * grey — so a picker opening on `#888888` had a hue slider whose thumb moved and
 * whose colour did not, and the only way to find out it worked at all was to
 * drag the saturation area first. Mid saturation and mid brightness also put the
 * area's own thumb in the middle of the square rather than in a corner with
 * nowhere to drag from, which is what white would do.
 */
export const DEFAULT_FALLBACK = "#3d7ea6";

/**
 * The wheel's own colour, held in HSB rather than re-derived from the stored hex
 * on every render.
 *
 * Hex is RGB, and the round trip through it **loses the hue** of anything grey:
 * `parseColor("#888888")` comes back at hue 0 whatever hue the slider was just
 * dragged to, so the next render put the thumb back at red and the control could
 * not be moved off a grey at all. Keeping the picker's own `Color` means the hue
 * someone chose survives until they raise the saturation that makes it visible.
 *
 * Re-seeded only when `value` changes to something that is *not* what we just
 * emitted — an outside edit, or a clear. Adjusting state during render rather
 * than in an effect, which is React's own documented answer here and the one that
 * does not repaint the wheel a frame late.
 */
export function useHsbDraft(value: string, fallback: string) {
  const [draft, setDraft] = useState<Color>(() => toHsb(value, fallback));
  const [seen, setSeen] = useState(value);

  if (value !== seen) {
    setSeen(value);
    if (hexOf(draft) !== value.toLowerCase()) setDraft(toHsb(value, fallback));
  }

  return [draft, setDraft] as const;
}

/** The picker's own value: HSB, so a hue survives a colour that cannot show it. */
function toHsb(value: string, fallback: string): Color {
  const color =
    safeColor(value) ?? safeColor(fallback) ?? parseColor(DEFAULT_FALLBACK);

  return color.toFormat("hsb");
}

/**
 * What leaves the picker: a `#rrggbb`, lowercased at the boundary. React Aria's
 * `Color` never leaves `components/ui/color-picker*` — everything stored in this
 * codebase is a hex string, read by an embed that has never heard of React Aria.
 */
export function hexOf(color: Color): string {
  return color.toString("hex").toLowerCase();
}

/**
 * `parseColor`, without the throw.
 *
 * What reaches here is a stored value that may predate this control, so falling
 * back rather than throwing is the same contract `resolveCardLayout` holds
 * itself to: a card must degrade, never take a page down.
 */
function safeColor(value: string) {
  if (!value) return null;

  try {
    return parseColor(value);
  } catch {
    return null;
  }
}
