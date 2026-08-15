"use client";

import { Button } from "@heroui/react";
import { ImageUp } from "lucide-react";
import { useRef, useState } from "react";

import {
  ALLOWED_PIN_IMAGE_TYPES,
  PinImageError,
  normalisePinImage,
} from "@/lib/map/normalise-pin-image";

/**
 * Upload a logo for a pin.
 *
 * Same idiom as the place photo field next door — an `sr-only` input clicked from
 * a real Button — but the resemblance stops at the markup. That one uploads to
 * storage the moment a file is picked, because a File cannot sit in form state
 * waiting for a submit. This one turns the file into a *string* (a small data
 * URI), and a string can wait perfectly well, so nothing is written anywhere
 * until the pin is saved. Cancelling the builder leaves no trace.
 *
 * It sits in the builder's footer, beside Cancel and Save, because uploading a
 * logo is one of the two ways to finish this pin rather than a step on the way
 * through it — and it stretches, so the row has no dead gap in the middle.
 *
 * A button and nothing else. It used to carry a paragraph on accepted formats
 * and in-browser resizing, which is the file picker's job (`accept`) and our
 * own; the failures it warned about all arrive as a specific message from
 * `normalisePinImage` at the moment they happen, which is when they can be acted
 * on. No dropzone frame either: nothing here accepts a drop, and a dashed border
 * would promise an interaction that doesn't exist.
 */
export function PinImageField({
  hasImage,
  onChange,
  onProblem,
}: {
  hasImage: boolean;
  /** "" clears the image and hands the head back to a glyph. */
  onChange: (image: string) => void;
  /**
   * Reported up rather than rendered here. `ErrorMessage` is a full-width Alert,
   * and the footer slot this button occupies is a third of a dialog row.
   */
  onProblem: (message: string | null) => void;
}) {
  const input = useRef<HTMLInputElement>(null);
  const [isReading, setIsReading] = useState(false);

  const read = async (file: File | undefined) => {
    if (!file) return;

    onProblem(null);
    setIsReading(true);

    try {
      onChange(await normalisePinImage(file));
    } catch (error) {
      // The normaliser's messages already say what to do about each failure, so
      // they are shown as written rather than replaced with a generic one.
      onProblem(
        error instanceof PinImageError
          ? error.message
          : "That image couldn't be read. Try another one.",
      );
    } finally {
      setIsReading(false);
    }
  };

  return (
    <div className="flex w-full min-w-0 sm:w-auto sm:flex-1">
      <input
        ref={input}
        type="file"
        className="sr-only"
        accept={ALLOWED_PIN_IMAGE_TYPES.join(",")}
        onChange={(event) => {
          void read(event.target.files?.[0]);
          // Cleared so picking the same file twice still fires a change.
          event.target.value = "";
        }}
      />

      <Button
        fullWidth
        variant="secondary"
        isPending={isReading}
        onPress={() => input.current?.click()}
      >
        <ImageUp aria-hidden="true" className="size-4" />
        {hasImage ? "Replace image" : "Upload an image"}
      </Button>
    </div>
  );
}
