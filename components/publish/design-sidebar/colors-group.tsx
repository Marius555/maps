"use client";

import { ColorPickerField } from "@/components/ui/color-picker-field";
import type { SnapshotColors } from "@/packages/shared/snapshot";
import type { EmbedDesign } from "./use-embed-design";

/**
 * The embed's own five colour tokens.
 *
 * Five and not fifty: `.lm-root` in embed/src/styles.css declares exactly this
 * set and the whole panel system follows from it, so these are the colours there
 * are rather than a subset somebody picked. Anything more would be inventing
 * knobs the stylesheet has no rule for.
 *
 * **Unset is a real answer and the one to leave alone**, which is why every
 * field can be cleared. An unset token is whatever the stylesheet says, and the
 * stylesheet says two things — `.lm-root--dark` redefines all five — so an
 * undesigned embed follows the basemap from light to dark on its own. A stored
 * `#ffffff` cannot, and a map whose owner set the surface white is a map with a
 * white panel on a midnight basemap. That is theirs to choose, but it has to be
 * chosen rather than arrived at.
 */
export function ColorsGroup({ settings, set }: EmbedDesign) {
  const colors = settings.colors ?? {};

  const setColor = (key: keyof SnapshotColors, hex: string | undefined) => {
    const next: SnapshotColors = { ...colors };

    if (hex) next[key] = hex;
    else delete next[key];

    // Nothing at all rather than an empty object: absent is what the embed
    // reads as "the stylesheet decides", and `{}` would be a key in every
    // snapshot saying exactly that at greater length.
    set("colors", Object.keys(next).length > 0 ? next : undefined);
  };

  /* No heading of its own: the accordion item this sits in already names it,
     and two headings one line apart is one too many.

     The labels stay *inside* these fields, which is `ColorPickerField`'s
     default and the opposite of what the card designer asks for. This fold is
     five colours and nothing else, so a name beside each swatch is a tidy list;
     there the same control sits in a column of label-above fields and has to
     match them. See `labelPlacement`. */
  return (
    <div className="space-y-2">
      {FIELDS.map(({ key, label, fallback }) => (
        <ColorPickerField
          key={key}
          label={label}
          value={colors[key] ?? ""}
          fallback={fallback}
          onChange={(hex) => setColor(key, hex)}
          onClear={colors[key] ? () => setColor(key, undefined) : undefined}
        />
      ))}
    </div>
  );
}

/**
 * The five, in the order they matter to somebody looking at the panel: the
 * surface first because it is most of what they see, then the text on it, then
 * the edges, then the one accent.
 *
 * `fallback` is the embed's own light-theme value — what the wheel opens on
 * when nothing is set, so the first drag starts from the colour on screen
 * rather than from red.
 */
const FIELDS: readonly {
  key: keyof SnapshotColors;
  label: string;
  fallback: string;
}[] = [
  { key: "surface", label: "Panel", fallback: "#ffffff" },
  { key: "foreground", label: "Text", fallback: "#1b1d21" },
  { key: "muted", label: "Secondary text", fallback: "#656b76" },
  { key: "border", label: "Lines", fallback: "#e2e5ea" },
  { key: "accent", label: "Accent", fallback: "#1c7ed6" },
];
