"use client";

import { Button, CloseButton, Description, Label } from "@heroui/react";
import { Plus, Star } from "lucide-react";
import { useEffect, useRef, useState } from "react";

import { IconButton } from "@/components/ui/icon-button";
import type { PhotoSlot } from "@/lib/photos/save-plan";
import {
  ALLOWED_PHOTO_TYPES,
  MAX_PHOTO_BYTES,
  MAX_PHOTOS_PER_PLACE,
} from "@/lib/validation/photo";

/**
 * The location's photos, as a draft.
 *
 * **They used to upload the instant they were picked**, on the argument that a
 * file cannot sit in form state waiting for a submit the way a string can. It
 * can — a `File` is an ordinary value, and the only thing it needs that a string
 * does not is an object URL to draw itself with. What the old arrangement
 * actually bought was a dialog where Cancel meant "discard everything except the
 * photos", and a Save button that did not save half of what was on screen. Every
 * control here is a draft now, and the form's own submit is the one moment
 * anything is written — see `useSavePlacePhotos`.
 *
 * **The cover is the first one, and that is the whole model.** No separate
 * "cover" flag to fall out of step with the order, and no reordering control
 * beyond it: what a visitor sees first is what the owner put first, and
 * "Make cover" is a move to the front.
 *
 * The plus tile is the picker. It was a dashed square reading "None" beside a
 * separate Upload photos button — a box that looked like a control and did
 * nothing, next to the control. One thing now, in the shape of what it makes.
 *
 * 64px thumbnails, the logo's size, so the two sit on one line in the place
 * form's media fold; the count sits beside the label so "how many more can I
 * add" is answered before anyone reaches the eighth.
 */
export function PhotoGalleryField({
  value,
  hideHint,
  onChange,
}: {
  value: PhotoSlot[];
  /** Leaves the format-and-size line to the caller — see `LogoField`. */
  hideHint?: boolean;
  onChange: (next: PhotoSlot[]) => void;
}) {
  const input = useRef<HTMLInputElement>(null);
  const [rejected, setRejected] = useState<string | null>(null);

  const isFull = value.length >= MAX_PHOTOS_PER_PLACE;

  /*
   * Every object URL this field is still holding, released when it goes away.
   *
   * A ref rather than an effect keyed on `value`: that would revoke a URL in the
   * very render that created it. Slots dropped one at a time are revoked by
   * `remove` below; this covers closing the dialog, which is the common case and
   * the one that would otherwise leak on every Cancel.
   */
  const live = useRef(value);
  useEffect(() => {
    live.current = value;
  });
  useEffect(
    () => () => {
      for (const slot of live.current) {
        if (slot.kind === "new") URL.revokeObjectURL(slot.url);
      }
    },
    [],
  );

  const remove = (index: number) => {
    const slot = value[index];
    if (slot.kind === "new") URL.revokeObjectURL(slot.url);

    onChange(value.filter((_, at) => at !== index));
  };

  const makeCover = (index: number) =>
    onChange([value[index], ...value.filter((_, at) => at !== index)]);

  /*
   * Checked here as a courtesy and again in the repository as the guarantee
   * (CLAUDE.md §9). Doing it here is what turns "your save failed" into a
   * message naming the one file that was wrong, before anything is uploaded.
   */
  const accept = (files: File[]) => {
    const room = MAX_PHOTOS_PER_PLACE - value.length;
    const taken: PhotoSlot[] = [];
    let refusal: string | null = null;

    for (const file of files) {
      if (taken.length >= room) {
        refusal = `A location holds ${MAX_PHOTOS_PER_PLACE} photos. The rest weren’t added.`;
        break;
      }

      if (!(ALLOWED_PHOTO_TYPES as readonly string[]).includes(file.type)) {
        refusal = `${file.name} isn’t a JPG, PNG, WebP or AVIF.`;
        continue;
      }

      if (file.size > MAX_PHOTO_BYTES) {
        refusal = `${file.name} is over ${megabytes(MAX_PHOTO_BYTES)}MB.`;
        continue;
      }

      taken.push({
        kind: "new",
        // Not the file name: picking two files called photo.jpg out of different
        // folders is ordinary, and a duplicate React key drops one of them.
        key: `${Date.now()}-${taken.length}-${file.name}`,
        file,
        url: URL.createObjectURL(file),
      });
    }

    setRejected(refusal);
    if (taken.length > 0) onChange([...value, ...taken]);
  };

  return (
    <div className="flex min-w-0 flex-col gap-2">
      <span className="flex items-baseline justify-between gap-2">
        <Label elementType="span">Photos</Label>
        <span className="text-xs tabular-nums text-muted">
          {value.length} of {MAX_PHOTOS_PER_PLACE}
        </span>
      </span>

      <div className="flex flex-wrap gap-2">
        {value.map((slot, index) => (
          <div
            key={slot.kind === "saved" ? slot.id : slot.key}
            className="relative"
          >
            {/* A plain img, not next/image: these are small thumbnails behind
                auth — and half of them are object URLs, which the image
                optimiser cannot fetch at all. */}
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={slot.url}
              alt={`Photo ${index + 1}`}
              width={64}
              height={64}
              className="size-16 rounded-lg object-cover ring-1 ring-border"
            />

            {index === 0 ? (
              <span className="absolute inset-x-1 bottom-1 rounded bg-foreground/75 px-1 py-px text-center text-[10px] font-medium text-background">
                Cover
              </span>
            ) : (
              <IconButton
                label="Make this the cover"
                icon={Star}
                size="sm"
                variant="secondary"
                className="absolute bottom-1 left-1 size-5 min-w-0"
                iconClassName="size-3"
                onPress={() => makeCover(index)}
              />
            )}

            <CloseButton
              type="button"
              aria-label={`Remove photo ${index + 1}`}
              className="absolute -right-2 -top-2 size-5 shadow-sm"
              onPress={() => remove(index)}
            />
          </div>
        ))}

        {/*
          HeroUI's Button, and deliberately not a label wrapping the input:
          Tailwind's `sr-only` is `position: absolute`, so inside a portalled
          modal the hidden input lays itself out against something else entirely
          and the page jumps to it on focus. Same trap as `theme-gallery.tsx`.

          `type="button"` is load-bearing: this sits inside the place form, and a
          bare button in a form submits it.
        */}
        {isFull ? null : (
          <Button
            type="button"
            variant="outline"
            isIconOnly
            aria-label="Add photos"
            onPress={() => input.current?.click()}
            className="size-16 rounded-lg border-dashed text-muted"
          >
            <Plus aria-hidden="true" className="size-5" />
          </Button>
        )}
      </div>

      <input
        ref={input}
        type="file"
        multiple
        className="sr-only"
        accept={ALLOWED_PHOTO_TYPES.join(",")}
        onChange={(event) => {
          const files = [...(event.target.files ?? [])];
          // Cleared so picking the same file twice still fires a change.
          event.target.value = "";
          if (files.length > 0) accept(files);
        }}
      />

      {isFull ? (
        <Description>
          That&rsquo;s all {MAX_PHOTOS_PER_PLACE}. Remove one to add another.
        </Description>
      ) : hideHint ? null : (
        <Description>
          JPG, PNG, WebP or AVIF, up to {megabytes(MAX_PHOTO_BYTES)}MB each. The
          first is the cover. They upload when you save.
        </Description>
      )}

      {rejected ? <p className="text-xs text-danger">{rejected}</p> : null}
    </div>
  );
}

export function megabytes(bytes: number): number {
  return Math.round(bytes / 1024 / 1024);
}
