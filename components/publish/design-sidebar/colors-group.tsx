"use client";

import { useEffect, useRef, useState } from "react";

import {
  ColorSwatchRow,
  type LeadingSwatch,
} from "@/components/ui/color-swatch-row/color-swatch-row";
import { DEFAULT_EMBED_ACCENT } from "@/lib/validation/embed-settings.schema";
import type { SnapshotColors } from "@/packages/shared/snapshot";
import { BRIGHT_PRESETS, TOKEN_PRESETS } from "@/components/ui/color-swatch-row/presets";
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
 *
 * **The sixth field is not one of them, and that is why it is separate.** Default
 * pin is `settings.pinColor`, a sibling key rather than a member of `colors`, and
 * the reason is mechanical: `colors` is in `CHROME_SETTING_KEYS`, so those five
 * are custom properties the preview writes onto the running map. A pin is not —
 * the markers and the results rows are canvas images cached per
 * `pinImageId(icon, color)`, so only a rebuild recolours them. It therefore goes
 * through `PinColorField` below, which is the same control on a trailing timer.
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

     Each colour is one line of swatches — the theme's answer first, four
     presets, then any colour behind the wheel. The first swatch is also how a
     token goes back to unset: for the four panel tokens it *is* unset ("the
     stylesheet decides", which follows the basemap into the dark), and for
     the accent it clears the key, since absent already resolves to the
     orange and storing it would add bytes to every snapshot for nothing. */
  return (
    <div className="space-y-3">
      {FIELDS.map(({ key, label, fallback }) => (
        <ColorSwatchRow
          key={key}
          label={label}
          value={colors[key] ?? ""}
          leading={key === "accent" ? THEME_ACCENT_CLEARS : DEFAULT_SWATCH}
          presets={key === "accent" ? BRIGHT_PRESETS : TOKEN_PRESETS[key]}
          fallback={fallback}
          onChange={(hex) => setColor(key, hex)}
        />
      ))}

      {/* Last, and under the five: it is the only colour here that is not a
          token of the panel — it is what the map itself draws a location in when
          the location says nothing. */}
      <PinColorField
        value={settings.pinColor}
        onChange={(hex) => set("pinColor", hex)}
      />
    </div>
  );
}

const DEFAULT_SWATCH: LeadingSwatch = { kind: "default" };

/** The accent's first swatch: the theme orange, pressed as "unset". */
const THEME_ACCENT_CLEARS: LeadingSwatch = {
  kind: "color",
  color: DEFAULT_EMBED_ACCENT,
  name: "Theme orange",
  emit: undefined,
};

/** The pin's first swatch: the same orange, stored — `pinColor` is required. */
const THEME_PIN: LeadingSwatch = {
  kind: "color",
  color: DEFAULT_EMBED_ACCENT,
  name: "Theme orange",
  emit: DEFAULT_EMBED_ACCENT,
};

/**
 * Default pin, on a trailing timer.
 *
 * Every other field in this fold is free to drag: `colors` is a chrome key, so
 * the preview writes the new value straight onto the running map and a
 * pointer-move-per-frame costs nothing. `pinColor` is not and cannot be — pins
 * are rasterised images, so the preview has to rebuild its document to recolour
 * them — and the custom swatch's wheel fires `onChange` per pointer move.
 *
 * React Aria's `onChangeEnd` would be the exact tool and this build of
 * `react-aria-components` does not expose it on `ColorArea` or `ColorSlider`, so
 * the timer stands in: the swatch tracks the pointer from local state, and the
 * draft — and with it the preview — learns the answer once the drag settles.
 * `EmbedPreview`'s one-navigation-at-a-time guard would have coalesced most of
 * the churn anyway; this is what turns "most" into one.
 */
function PinColorField({
  value,
  onChange,
}: {
  value: string;
  onChange: (hex: string) => void;
}) {
  const [draft, setDraft] = useState(value);
  const [seen, setSeen] = useState(value);
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  /*
   * An outside edit wins — Reset is the one that matters, and it lands here as
   * a `value` that is not what this field last emitted. Adjusting state during
   * render rather than in an effect, which is `useHsbDraft`'s own answer to
   * the same question a few lines away.
   */
  if (value !== seen) {
    setSeen(value);
    if (value !== draft) setDraft(value);
  }

  // A drag that ends by unmounting the panel must still be saved.
  useEffect(() => () => clearTimeout(timer.current), []);

  return (
    <ColorSwatchRow
      label="Default pin"
      value={draft}
      leading={THEME_PIN}
      presets={BRIGHT_PRESETS}
      fallback={DEFAULT_EMBED_ACCENT}
      onChange={(next) => {
        const hex = next ?? DEFAULT_EMBED_ACCENT;
        setDraft(hex);
        setSeen(hex);
        clearTimeout(timer.current);
        timer.current = setTimeout(() => {
          onChange(hex);
        }, COMMIT_DELAY_MS);
      }}
    />
  );
}

/**
 * Long enough that a drag is one rebuild, short enough that a single press feels
 * immediate. The same order as `useEmbedDesign`'s own write timer, deliberately
 * under it so the preview is never behind the save.
 */
const COMMIT_DELAY_MS = 250;

/**
 * The five, in the order they matter to somebody looking at the panel: the
 * surface first because it is most of what they see, then the text on it, then
 * the edges, then the one accent.
 *
 * `fallback` is what the swatch draws when nothing is stored, so the first drag
 * starts from the colour already on screen rather than from red. For four of
 * them that is the embed's own light-theme value; the accent's is the product
 * default the settings now seed, which is the colour the map is actually
 * wearing.
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
  { key: "accent", label: "Accent", fallback: DEFAULT_EMBED_ACCENT },
];
