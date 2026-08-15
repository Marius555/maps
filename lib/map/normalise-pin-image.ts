"use client";

import { MAX_PIN_IMAGE_BYTES, base64Bytes } from "@/lib/validation/pin-icon.schema";

/**
 * An uploaded logo → a small square data URI, in the browser.
 *
 * Normalising here rather than on the server is what makes the whole feature
 * cheap, and it settles three problems at once:
 *
 * - **SVG never reaches us.** An SVG is a document that can run script, and there
 *   is no version of storing one and serving it back from an origin we own that is
 *   worth this feature. Drawn to a canvas it is just pixels, and the browser
 *   refuses to load anything external out of it along the way.
 * - **No upload route, no bucket, no orphaned files.** The result is small enough
 *   to live inside the map's own JSON, so it saves through the map PATCH that
 *   already exists and is deleted by removing an array entry.
 * - **The size cap is enforceable.** The embed inlines this into every visitor's
 *   snapshot (§2 forbids fetching it), so "a few KB" is not a nicety.
 *
 * Format is chosen by result, not by input. PNG first, because a flat logo is
 * smaller and sharper as PNG than as WebP; WebP only when PNG overshoots, which
 * is the photographic or gradient-heavy case where it wins by a wide margin.
 * Refusing outright is the last resort, and the message says what to do about it.
 */

/**
 * Square, and larger than the pin needs.
 *
 * The pin renders at 36 CSS px and the image occupies the head, so about 20px —
 * 40 device pixels on a retina screen, and the embed rasterises at 2×. 96 leaves
 * room for a bigger pin later without re-uploading every logo, and costs little:
 * a flat logo's PNG size is driven by how many colours it has, not by its width.
 */
const CANVAS_SIZE = 96;

/** Tried in order, first one under the cap wins. */
const ENCODINGS: { type: string; quality?: number }[] = [
  { type: "image/png" },
  { type: "image/webp", quality: 0.9 },
  { type: "image/webp", quality: 0.75 },
];

export class PinImageError extends Error {}

/** What the browser accepts on the file input, and what `decode` can handle. */
export const ALLOWED_PIN_IMAGE_TYPES = [
  "image/png",
  "image/jpeg",
  "image/webp",
  "image/avif",
  "image/svg+xml",
] as const;

export async function normalisePinImage(file: File): Promise<string> {
  const source = await decode(file);

  const canvas = document.createElement("canvas");
  canvas.width = CANVAS_SIZE;
  canvas.height = CANVAS_SIZE;

  const context = canvas.getContext("2d");
  if (!context) {
    throw new PinImageError("Your browser couldn't read that image. Try another one.");
  }

  /*
   * Contained, not cropped, on transparent ground. A logo is a whole shape and
   * cropping one to fill a square is how a wordmark becomes three letters. The
   * transparent margin costs nothing — it is what the pin's own colour shows
   * through, and the circular clip in the head trims the corners anyway.
   */
  const scale = Math.min(CANVAS_SIZE / source.width, CANVAS_SIZE / source.height);
  const width = source.width * scale;
  const height = source.height * scale;

  context.drawImage(
    source.image,
    (CANVAS_SIZE - width) / 2,
    (CANVAS_SIZE - height) / 2,
    width,
    height,
  );

  for (const encoding of ENCODINGS) {
    const encoded = await toDataUri(canvas, encoding);

    if (encoded && base64Bytes(encoded) <= MAX_PIN_IMAGE_BYTES) return encoded;
  }

  throw new PinImageError(
    "That image is too detailed for a pin. Try a flat-colour version of your logo.",
  );
}

/**
 * File → pixels, without ever handing the file's bytes to anything but the
 * browser's own decoder.
 *
 * `createImageBitmap` handles every raster format directly, but not SVG — for
 * that the file has to go through an `<img>`, which is also what refuses to load
 * any external reference the SVG might carry. A blob URL rather than a data URI
 * because it is same-origin, so the canvas it is drawn into stays untainted and
 * `toBlob` still works.
 */
type Decoded = { image: CanvasImageSource; width: number; height: number };

async function decode(file: File): Promise<Decoded> {
  if (file.type !== "image/svg+xml") {
    try {
      const bitmap = await createImageBitmap(file);
      return { image: bitmap, width: bitmap.width, height: bitmap.height };
    } catch {
      throw new PinImageError(
        "That file isn't an image we can read. Use a PNG, JPG, WebP or SVG.",
      );
    }
  }

  const url = URL.createObjectURL(file);

  try {
    const image = await new Promise<HTMLImageElement>((resolve, reject) => {
      const element = new Image();

      element.onload = () => resolve(element);
      element.onerror = () =>
        reject(
          new PinImageError("That SVG couldn't be read. Try exporting it as a PNG."),
        );
      element.src = url;
    });

    /*
     * An SVG with no width, height or viewBox has no intrinsic size, and browsers
     * disagree about what to report — 0 in some, 300×150 in others. Zero would
     * make the scale below Infinity and draw nothing, so it is squared off here
     * rather than left to produce an empty pin with no error.
     */
    return {
      image,
      width: image.naturalWidth || CANVAS_SIZE,
      height: image.naturalHeight || CANVAS_SIZE,
    };
  } finally {
    URL.revokeObjectURL(url);
  }
}

function toDataUri(
  canvas: HTMLCanvasElement,
  { type, quality }: { type: string; quality?: number },
): Promise<string | null> {
  return new Promise((resolve) => {
    canvas.toBlob(
      (blob) => {
        // A format the browser cannot encode yields null rather than throwing,
        // which is exactly the answer the caller wants: try the next one.
        if (!blob) return resolve(null);

        const reader = new FileReader();
        reader.onload = () => resolve(reader.result as string);
        reader.onerror = () => resolve(null);
        reader.readAsDataURL(blob);
      },
      type,
      quality,
    );
  });
}
