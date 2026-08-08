"use client";

import { Button } from "@heroui/react";
import { useRef } from "react";

import { ErrorMessage } from "@/components/ui/error-message";
import { useRemovePlacePhoto, useUploadPlacePhoto } from "@/lib/query/photo";
import type { Place } from "@/lib/repositories/types";
import { ALLOWED_PHOTO_TYPES, MAX_PHOTO_BYTES } from "@/lib/validation/photo";

/**
 * The photo saves immediately, unlike the rest of the form.
 *
 * A file can't sit in form state waiting for a submit the way a string can, and
 * an upload that only happened on save would silently discard the file if the
 * form was cancelled. The button says Upload and the photo appears — the action
 * keeps its name through the flow (CLAUDE.md §8).
 */
export function PhotoField({ mapId, place }: { mapId: string; place: Place }) {
  const input = useRef<HTMLInputElement>(null);
  const upload = useUploadPlacePhoto(mapId);
  const remove = useRemovePlacePhoto(mapId);

  const onPick = (file: File | undefined) => {
    if (!file) return;
    upload.mutate({ placeId: place.id, file });
  };

  return (
    <div className="space-y-2">
      <span className="block text-sm font-medium text-foreground">Photo</span>

      <div className="flex items-center gap-3">
        {place.photoUrl ? (
          // A plain img, not next/image: this is a small thumbnail behind auth,
          // and routing it through the image optimiser would add a per-request
          // transform cost for no visible gain.
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={place.photoUrl}
            alt={`Photo of ${place.name}`}
            width={64}
            height={64}
            className="size-16 shrink-0 rounded-lg object-cover ring-1 ring-border"
          />
        ) : (
          <div
            aria-hidden="true"
            className="grid size-16 shrink-0 place-items-center rounded-lg border border-dashed border-border text-xs text-muted"
          >
            None
          </div>
        )}

        <div className="flex flex-wrap gap-2">
          <input
            ref={input}
            type="file"
            className="sr-only"
            accept={ALLOWED_PHOTO_TYPES.join(",")}
            onChange={(event) => {
              onPick(event.target.files?.[0]);
              // Cleared so picking the same file twice still fires a change.
              event.target.value = "";
            }}
          />

          <Button
            size="sm"
            variant="secondary"
            isPending={upload.isPending}
            onPress={() => input.current?.click()}
          >
            {place.photoUrl ? "Replace photo" : "Upload photo"}
          </Button>

          {place.photoUrl ? (
            <Button
              size="sm"
              variant="tertiary"
              isPending={remove.isPending}
              onPress={() => remove.mutate(place.id)}
            >
              Remove
            </Button>
          ) : null}
        </div>
      </div>

      <p className="text-xs text-muted">
        JPG, PNG, WebP or AVIF, up to {Math.round(MAX_PHOTO_BYTES / 1024 / 1024)}
        MB.
      </p>

      {upload.error ? <ErrorMessage error={upload.error} /> : null}
      {remove.error ? <ErrorMessage error={remove.error} /> : null}
    </div>
  );
}
