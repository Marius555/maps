"use client";

import { useState } from "react";

import { PhotoGalleryField } from "@/components/places/place-form/photo-gallery-field";
import { useSavePlacePhotos } from "@/lib/query/photo";
import type { PhotoSlot } from "@/lib/photos/save-plan";
import type { Place } from "@/lib/repositories/types";
import { SlotShell } from "./slot-shell";

/**
 * The photo band, which is the one slot that does not go through
 * `useUpdatePlace`.
 *
 * A gallery is three endpoints rather than a column — add, remove, reorder — and
 * `useSavePlacePhotos` is the hook that turns "what it should look like" into
 * calls to them in the one order that is safe. Reused whole rather than reaching
 * for the upload route directly, because the ordering rules it documents (remove
 * first, then add in one request, then reorder) are not rules this file should
 * be holding a second copy of.
 *
 * `savedIds: place.photoIds` is what the row held when the popover opened, which
 * is what makes a retry after a partial failure upload nothing twice — the same
 * contract `PlaceForm` relies on. `onPlace` rewrites the slots after every stage
 * that wrote a row, for exactly that reason.
 *
 * Unlike every other slot this one is genuinely slow: it is a file upload, so
 * the pending state on Add is doing real work rather than covering a round trip
 * nobody sees.
 */
export function SlotPhotosForm({
  mapId,
  place,
  title,
  onDone,
}: {
  mapId: string;
  place: Place;
  title: string;
  onDone: () => void;
}) {
  const savePhotos = useSavePlacePhotos(mapId);
  const [photos, setPhotos] = useState<PhotoSlot[]>(() =>
    place.photoIds.map((id, index) => ({
      kind: "saved",
      id,
      url: place.photoUrls[index],
    })),
  );

  const submit = async () => {
    try {
      await savePhotos.mutateAsync({
        placeId: place.id,
        slots: photos,
        savedIds: place.photoIds,
        onPlace: (written) =>
          setPhotos(
            written.photoIds.map((id, index) => ({
              kind: "saved",
              id,
              url: written.photoUrls[index],
            })),
          ),
      });

      onDone();
    } catch {
      // Rendered from the mutation's own error below.
    }
  };

  return (
    <SlotShell
      title={title}
      error={savePhotos.error}
      isPending={savePhotos.isPending}
      isDisabled={photos.length === 0}
      onSubmit={() => void submit()}
      onCancel={onDone}
    >
      <PhotoGalleryField value={photos} onChange={setPhotos} />
    </SlotShell>
  );
}
