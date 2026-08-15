import { z } from "zod";

import { hexColorSchema } from "./common";

/**
 * The pins a customer builds for themselves.
 *
 * Shaped after `category.schema.ts`, because they are the same kind of thing: a
 * short list of named, coloured records living in one JSON column on the map,
 * referenced from a place by a stable id.
 *
 * The one real difference is that a pin can carry an uploaded image, and that
 * image is stored *inline* as a data URI rather than as a file id. Two reasons,
 * both load-bearing:
 *
 * - The embed has to draw it on a stranger's website with no request in the
 *   visitor's path (CLAUDE.md §2) and no CSP surface. Inlined, it decodes through
 *   a Blob and `createImageBitmap`, which loads no URL at all.
 * - `lib/snapshot/build.ts` stays pure and synchronous, which is what lets the
 *   preview dialog build the very same snapshot in the browser.
 *
 * That trade is paid for with the caps below, which is why they are tight.
 */

/**
 * Enough for a brand to distinguish its location types without turning the map
 * into a sticker album. Eight pins at the size cap is ~64KB on the row and the
 * same again on every published snapshot.
 */
export const MAX_PIN_ICONS = 8;

/**
 * Decoded bytes, before base64's 33% overhead. A 96×96 flat-colour logo lands at
 * 2–4KB as PNG, so this is roughly double what a real one needs — and the client
 * normaliser (lib/map/normalise-pin-image.ts) re-encodes as WebP rather than
 * failing anything that overshoots on the first try.
 */
export const MAX_PIN_IMAGE_BYTES = 6 * 1024;

/**
 * Only formats the normaliser can produce. The uploaded file is rasterised in the
 * browser before it is ever sent, which is what keeps customer SVG out of our
 * storage and off our origin entirely — an SVG is a script that runs, and there
 * is no version of serving one that is worth this feature.
 */
const DATA_URI = /^data:image\/(png|webp);base64,[A-Za-z0-9+/]+={0,2}$/;

/** Decoded length from the encoded one, without decoding a possibly huge string. */
export function base64Bytes(dataUri: string): number {
  const encoded = dataUri.slice(dataUri.indexOf(",") + 1);
  const padding = encoded.endsWith("==") ? 2 : encoded.endsWith("=") ? 1 : 0;

  return Math.floor((encoded.length * 3) / 4) - padding;
}

export const pinIconSchema = z
  .object({
    /** Stable across renames and recolours — places reference this, not the label. */
    id: z.string().trim().min(1).max(36),
    label: z
      .string()
      .trim()
      .min(1, "Give the pin a name.")
      .max(32, "Keep the name under 32 characters."),
    color: hexColorSchema,
    /** A packages/shared/pin-icons.ts id, or "". */
    glyph: z.string().trim().max(64).default(""),
    image: z
      .string()
      .trim()
      .default("")
      .refine(
        (value) => value === "" || DATA_URI.test(value),
        "That image couldn't be read. Upload a PNG, JPG, WebP or SVG.",
      )
      .refine(
        (value) => value === "" || base64Bytes(value) <= MAX_PIN_IMAGE_BYTES,
        "That image is too detailed for a pin. Try a flat-colour version of your logo.",
      ),
  })
  .refine(
    (icon) => Boolean(icon.glyph) !== Boolean(icon.image),
    "A pin is either an icon or an image, not both and not neither.",
  );

export const pinIconsSchema = z
  .array(pinIconSchema)
  .max(MAX_PIN_ICONS, `You can have up to ${MAX_PIN_ICONS} custom pins.`)
  .refine(
    (icons) => new Set(icons.map((icon) => icon.id)).size === icons.length,
    "Two pins share an id.",
  )
  .refine(
    (icons) =>
      new Set(icons.map((icon) => icon.label.toLowerCase())).size === icons.length,
    "Two pins have the same name. Give each one a distinct name.",
  );

export type PinIconInput = z.output<typeof pinIconSchema>;
