"use client";

import { Plus, Star, X } from "lucide-react";
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
 */
export function PhotoGalleryField({
  value,
  onChange,
}: {
  value: PhotoSlot[];
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
    <div className="space-y-2">
      <span className="block text-sm font-medium text-foreground">Photos</span>

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
              width={80}
              height={80}
              className="size-20 rounded-lg object-cover ring-1 ring-border"
            />

            {index === 0 ? (
              <span className="absolute bottom-1 left-1 rounded bg-foreground/75 px-1.5 py-px text-[10px] font-medium text-background">
                Cover
              </span>
            ) : (
              <IconButton
                label="Make this the cover"
                icon={Star}
                size="sm"
                variant="secondary"
                className="absolute bottom-1 left-1"
                iconClassName="size-3"
                onPress={() => makeCover(index)}
              />
            )}

            <IconButton
              label={`Remove photo ${index + 1}`}
              icon={X}
              size="sm"
              variant="secondary"
              className="absolute -right-1.5 -top-1.5"
              iconClassName="size-3"
              onPress={() => remove(index)}
            />
          </div>
        ))}

        {/*
          A native button, not HeroUI's, for the reason `pin-tile.tsx` gives —
          and deliberately not a label wrapping the input either: Tailwind's
          `sr-only` is `position: absolute`, so inside a portalled modal the
          hidden input lays itself out against something else entirely and the
          page jumps to it on focus. Same trap as `theme-gallery.tsx`.

          `type="button"` is load-bearing: this sits inside the place form, and a
          bare button in a form submits it.
        */}
        {isFull ? null : (
          <button
            type="button"
            aria-label="Add a photo"
            title="Add a photo"
            onClick={() => input.current?.click()}
            className="grid size-20 cursor-pointer place-items-center rounded-lg border border-dashed border-border text-muted transition-colors hover:border-foreground hover:text-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--focus)]"
          >
            <Plus aria-hidden="true" className="size-6" />
          </button>
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

      <p className="text-xs text-muted">
        {isFull
          ? `That’s all ${MAX_PHOTOS_PER_PLACE}. Remove one to add another.`
          : `JPG, PNG, WebP or AVIF, up to ${megabytes(MAX_PHOTO_BYTES)}MB each. ${MAX_PHOTOS_PER_PLACE} photos per location; the first is the cover. They upload when you save.`}
      </p>

      {rejected ? <p className="text-xs text-danger">{rejected}</p> : null}
    </div>
  );
}

function megabytes(bytes: number): number {
  return Math.round(bytes / 1024 / 1024);
}
