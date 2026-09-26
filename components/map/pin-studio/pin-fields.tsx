"use client";

import { Input, Label, Separator, Tabs, TextField } from "@heroui/react";
import { useState, type ReactNode } from "react";

import { PinPreview } from "@/components/map/pin-preview";
import { ColorSwatchRow } from "@/components/ui/color-swatch-row/color-swatch-row";
import {
  PALETTE_PRESETS,
  PIN_TRIM_PRESETS,
} from "@/components/ui/color-swatch-row/presets";
import { DEFAULT_PALETTE_COLOR } from "@/lib/validation/palette";
import { lightnessOf, parseColor } from "@/packages/shared/color";
import { PIN_ICONS, type CustomPinIcon } from "@/packages/shared/pin-icons";
import { PinImagePanel } from "./pin-image-panel";
import { PinOptionGroup } from "./pin-option-group";

/**
 * Every decision that goes into a pin: its name, what is in its head, its
 * colours, and its style (shape, size, ring).
 *
 * This is the part of the builder that scrolls. The pin being made holds still
 * beside it (desktop) or above it (phone sheet), and the buttons that finish the
 * form stay pinned below — PinStudio owns that arrangement.
 *
 * The head is a pair of HeroUI tabs, Icon and Image, because `image` and `glyph`
 * are exclusive (`pinIconSchema` refuses anything else) and the tabs say so where
 * a footer upload button and a "Use an icon instead" button did not. Leaving the
 * Image tab for Icon puts the icon back; the image is stashed, so coming back to
 * Image restores it rather than asking for the file again.
 *
 * **Style** is HeroUI segmented controls rather than a carousel of pin
 * thumbnails per option. The shape row still draws your pin as each shape; size
 * and ring are words, because a 20px preview cannot show the difference between a
 * thin and a regular ring and the hero beside it can.
 *
 * The colour rows are the app's swatch row (HeroUI's `ColorSwatchPicker`), since
 * a colour cannot preview itself as a white pin on a white dialog.
 */
/** The trim rows' first swatch: no colour of its own. */
const AUTOMATIC = { kind: "default", name: "Automatic" } as const;

/** `PIN_TRIM_PRESETS`' dark swatch, for a glyph on a light pin. */
const INK = "#111827";

/**
 * Whether a fill is pale enough that a white glyph on it disappears. OKLab
 * lightness, so it is perceptual: white is 1, the palette's brights sit near
 * 0.6–0.7 and keep their white icon.
 */
function isLight(hex: string): boolean {
  const color = parseColor(hex);
  return color !== null && lightnessOf(color) > 0.8;
}

type Head = "icon" | "image";

export function PinFields({
  draft,
  onChange,
}: {
  draft: CustomPinIcon;
  onChange: (draft: CustomPinIcon) => void;
}) {
  const [head, setHead] = useState<Head>(draft.image ? "image" : "icon");
  // What the other tab held when you left it, so switching back is not a loss.
  const [stash, setStash] = useState<{ image: string; glyph: string }>({
    image: "",
    glyph: "",
  });

  /**
   * An image in, or out. Clearing it has to hand the head back to a glyph —
   * `pinIconSchema` refuses a pin that is neither — and the one it had before,
   * else the first built-in, is a better answer than an empty pin.
   */
  const setImage = (image: string) =>
    onChange({
      ...draft,
      image,
      glyph: image ? "" : draft.glyph || stash.glyph || PIN_ICONS[0].id,
    });

  const switchHead = (next: Head) => {
    if (next === head) return;
    setHead(next);

    if (next === "icon" && draft.image) {
      setStash({ image: draft.image, glyph: stash.glyph });
      setImage("");
    } else if (next === "image") {
      setStash({ image: stash.image, glyph: draft.glyph });
      if (stash.image) {
        onChange({ ...draft, image: stash.image, glyph: "" });
      }
    }
  };

  /**
   * Your pin with `patch` applied — an option's picture. Callers pin `size` to
   * medium: a large pin scales past the box it is drawn in, into its neighbour.
   */
  const miniPin = (patch: Partial<CustomPinIcon>) => (
    <PinPreview
      icon="custom:preview"
      pinIcons={[{ ...draft, id: "preview", ...patch }]}
    />
  );

  return (
    <div className="flex flex-col gap-5">
      {/* First, and full width: the name is the first thing you say about a pin,
          and alone under the stage it had a column to itself and wasted it. */}
      <TextField
        className="w-full"
        value={draft.label}
        onChange={(label) => onChange({ ...draft, label })}
      >
        <Label>Name</Label>
        <Input placeholder="e.g. Flagship store" />
      </TextField>

      {/* No section heading: the tabs name themselves, and "Head" named nothing
          a customer would call it. */}
      <Tabs
        className="w-full gap-3"
        selectedKey={head}
        onSelectionChange={(key) => switchHead(key as Head)}
      >
        <Tabs.ListContainer>
          <Tabs.List aria-label="What goes in the pin">
            <Tabs.Tab id="icon">
              Icon
              <Tabs.Indicator />
            </Tabs.Tab>
            <Tabs.Tab id="image">
              Image
              <Tabs.Indicator />
            </Tabs.Tab>
          </Tabs.List>
        </Tabs.ListContainer>

        <Tabs.Panel id="icon" className="flex flex-col gap-4 p-0">
          <PinOptionGroup
            label="Icon"
            value={draft.glyph}
            options={PIN_ICONS.map((icon) => ({ value: icon.id, label: icon.label }))}
            preview={(glyph) => miniPin({ glyph, image: "", size: "md" })}
            isIconOnly
            isDetached
            onChange={(glyph) => onChange({ ...draft, glyph, image: "" })}
          />

          <ColorSwatchRow
            label="Icon colour"
            value={draft.iconColor ?? ""}
            leading={AUTOMATIC}
            presets={PIN_TRIM_PRESETS}
            fallback="#ffffff"
            onChange={(iconColor) => onChange({ ...draft, iconColor: iconColor ?? "" })}
          />
        </Tabs.Panel>

        <Tabs.Panel id="image" className="p-0">
          <PinImagePanel
            image={draft.image}
            onChange={(image) => {
              if (!image) setStash({ ...stash, image: "" });
              setImage(image);
            }}
          />
        </Tabs.Panel>
      </Tabs>

      <Separator />

      <Section title="Colour">
        <ColorSwatchRow
          label="Fill"
          value={draft.color}
          presets={PALETTE_PRESETS}
          fallback={DEFAULT_PALETTE_COLOR}
          onChange={(color) => {
            if (!color) return;
            // A light fill with the icon on Automatic draws a white glyph on a
            // white pin — no icon at all. Ink is written out rather than
            // changing what Automatic means, because published maps read an
            // absent icon colour as white forever (CLAUDE.md: absent means the
            // old behaviour). The Icon colour row shows it, so it can be undone.
            const iconColor =
              !draft.iconColor && isLight(color) ? INK : draft.iconColor;
            onChange({ ...draft, color, iconColor });
          }}
        />

        {/* Only once there is a ring to colour. At "none" this row would be a
            palette with no visible effect, which reads as a broken control. */}
        {draft.ringWidth !== "none" ? (
          <ColorSwatchRow
            label="Ring colour"
            value={draft.ring ?? ""}
            leading={AUTOMATIC}
            presets={PIN_TRIM_PRESETS}
            fallback="#ffffff"
            // "" is automatic: white on a light map, the accent's foreground on
            // a dark one — which no stored colour could be.
            onChange={(ring) => onChange({ ...draft, ring: ring ?? "" })}
          />
        ) : null}
      </Section>

      <Separator />

      <Section title="Style">
        <PinOptionGroup
          label="Shape"
          value={draft.shape ?? "circle"}
          options={SHAPES}
          preview={(shape) => miniPin({ shape, size: "md" })}
          onChange={(shape) => onChange({ ...draft, shape })}
        />

        <PinOptionGroup
          label="Size"
          value={draft.size ?? "md"}
          options={SIZES}
          onChange={(size) => onChange({ ...draft, size })}
        />

        <PinOptionGroup
          label="Ring"
          value={draft.ringWidth ?? "regular"}
          options={RING_WIDTHS}
          onChange={(ringWidth) => onChange({ ...draft, ringWidth })}
        />
      </Section>
    </div>
  );
}

/** A titled run of controls. The title is small caps so the rows keep the weight. */
function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="flex flex-col gap-4">
      <h3 className="text-xs font-medium uppercase tracking-wide text-muted">{title}</h3>
      {children}
    </section>
  );
}

/**
 * The option lists, out of the render.
 *
 * The labels are the customer's words for these, not the stored token — "Thick",
 * not "thick", and "Ring" rather than "ringWidth" (§8: name things by what the
 * user controls).
 */
const SHAPES = [
  { value: "circle", label: "Circle" },
  { value: "square", label: "Square" },
  { value: "diamond", label: "Diamond" },
] as const;

const SIZES = [
  { value: "sm", label: "Small" },
  { value: "md", label: "Medium" },
  { value: "lg", label: "Large" },
] as const;

const RING_WIDTHS = [
  { value: "none", label: "None" },
  { value: "thin", label: "Thin" },
  { value: "regular", label: "Regular" },
  { value: "thick", label: "Thick" },
] as const;
