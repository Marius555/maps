"use client";

import type { CSSProperties } from "react";

import {
  pinCssVars,
  pinSvg,
  resolvePin,
  type CustomPinIcon,
} from "@/packages/shared/pin-icons";

/**
 * A pin, drawn wherever the dashboard needs to show one outside the map.
 *
 * The same `pinSvg` markup the ghost and the markers use, injected as markup
 * rather than rebuilt as JSX. A second drawing of the same pin is how the tile
 * you pressed and the pin you got drift apart — so there is one, and everything
 * that shows a pin comes through here: the tiles in the add menu and the studio,
 * the location edit form, and every row in the Locations list.
 *
 * `pinSvg(null)` is a valid plain ball, not an empty string, which is what lets a
 * list row draw *every* location — including one that has never been given an
 * icon.
 *
 * Colour comes in as two props rather than one, because the map's answer has
 * three levels and the pin's own colour sits in the middle of them. `colorFor` in
 * components/editor/map-editor.tsx is the authority:
 *
 *     group colour  →  the custom pin's own colour  →  category  →  --accent
 *
 * So `color` is the override that beats the pin (a group's), `fallbackColor` is
 * what fills in when neither has one (a category's), and passing neither leaves
 * the stylesheet's `--accent`. Collapsing them into one prop would put the
 * category ahead of a custom pin's own design, and the list and the canvas would
 * then paint the same pin two colours.
 */
export function PinPreview({
  icon,
  pinIcons,
  color,
  fallbackColor,
  size = "md",
  className = "",
}: {
  /** "" for a plain pin, a built-in id, or `custom:<id>`. */
  icon: string;
  pinIcons: CustomPinIcon[];
  /** Beats the pin's own colour. Only a group does this. */
  color?: string;
  /** Used only when neither `color` nor the pin itself has one. */
  fallbackColor?: string;
  /**
   * `sm` in a list row, `tile`/`lg`/`xl` where the pin is the thing being
   * chosen. `lg` fills its slot and is capped; `tile` is a fixed size, for the
   * studio's option tiles — those stretch horizontally but keep a fixed height,
   * and a proportional width would resolve taller than the tile holding it.
   */
  size?: "sm" | "md" | "tile" | "lg" | "xl";
  className?: string;
}) {
  const pin = resolvePin(icon, pinIcons);

  return (
    <span
      aria-hidden="true"
      className={`pin-preview${size === "md" ? "" : ` pin-preview--${size}`}${
        className ? ` ${className}` : ""
      }`}
      // Ring, thickness, glyph colour and size travel with the fill, through the
      // one helper the markers and the drag ghost also use.
      style={pinCssVars(pin, color, fallbackColor) as CSSProperties}
      dangerouslySetInnerHTML={{ __html: pinSvg(pin) }}
    />
  );
}
