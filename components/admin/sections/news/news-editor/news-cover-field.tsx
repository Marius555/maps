"use client";

import { Button, Description, Label } from "@heroui/react";
import { ImagePlus, Trash2 } from "lucide-react";
import { useEffect, useRef, useState } from "react";

import { ALLOWED_PHOTO_TYPES, MAX_PHOTO_BYTES } from "@/lib/validation/photo";

/**
 * What the cover field holds: the image already on the post, a file picked but
 * not yet sent, or nothing. `LogoDraft`'s shape (place-form/logo-field.tsx), and
 * for its reason — nothing uploads until Save, so leaving the editor without
 * saving changes nothing.
 */
export type CoverDraft =
  | { kind: "saved"; url: string }
  | { kind: "new"; file: File; url: string }
  | null;

/** A post's cover image, as a draft. The editor uploads it after the post saves. */
export function NewsCoverField({
  value,
  onChange,
}: {
  value: CoverDraft;
  onChange: (next: CoverDraft) => void;
}) {
  const input = useRef<HTMLInputElement>(null);
  const [rejected, setRejected] = useState<string | null>(null);

  // The object URL still held, released when the editor goes away.
  const live = useRef(value);
  useEffect(() => {
    live.current = value;
  });
  useEffect(
    () => () => {
      if (live.current?.kind === "new") URL.revokeObjectURL(live.current.url);
    },
    [],
  );

  const release = () => {
    if (value?.kind === "new") URL.revokeObjectURL(value.url);
  };

  const accept = (file: File) => {
    if (!(ALLOWED_PHOTO_TYPES as readonly string[]).includes(file.type)) {
      setRejected(`${file.name} isn’t a JPG, PNG, WebP or AVIF.`);
      return;
    }

    if (file.size > MAX_PHOTO_BYTES) {
      setRejected(`${file.name} is over 5MB.`);
      return;
    }

    release();
    setRejected(null);
    onChange({ kind: "new", file, url: URL.createObjectURL(file) });
  };

  const pick = () => input.current?.click();

  return (
    <div className="flex flex-col gap-2">
      <Label elementType="span">Cover image</Label>

      {value ? (
        <div className="space-y-2">
          <div className="aspect-[16/9] overflow-hidden rounded-xl border border-border bg-surface-secondary">
            {/* A plain img: a picked file is an object URL, which next/image cannot fetch. */}
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={value.url} alt="Cover preview" className="size-full object-cover" />
          </div>
          <div className="flex flex-wrap gap-2">
            <Button type="button" size="sm" variant="secondary" onPress={pick}>
              <ImagePlus aria-hidden="true" className="size-4" />
              Replace
            </Button>
            <Button
              type="button"
              size="sm"
              variant="tertiary"
              onPress={() => {
                release();
                setRejected(null);
                onChange(null);
              }}
            >
              <Trash2 aria-hidden="true" className="size-4" />
              Remove
            </Button>
          </div>
        </div>
      ) : (
        <Button
          type="button"
          variant="outline"
          onPress={pick}
          className="aspect-[16/9] h-auto w-full flex-col gap-2 rounded-xl border-dashed text-muted"
        >
          <ImagePlus aria-hidden="true" className="size-6" />
          Add a cover image
        </Button>
      )}

      {/* Not wrapped in a label — see logo-field.tsx for the sr-only trap. */}
      <input
        ref={input}
        type="file"
        className="sr-only"
        accept={ALLOWED_PHOTO_TYPES.join(",")}
        onChange={(event) => {
          const file = event.target.files?.[0];
          event.target.value = "";
          if (file) accept(file);
        }}
      />

      <Description>
        Optional. JPG, PNG, WebP or AVIF, up to 5MB, shown 16:9. Without one, the card draws a
        pattern. It uploads when you save.
      </Description>

      {rejected ? <p className="text-xs text-danger">{rejected}</p> : null}
    </div>
  );
}
