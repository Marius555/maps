"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";

import {
  desiredOrder,
  planPhotoSave,
  sameOrder,
  type PhotoSlot,
} from "@/lib/photos/save-plan";
import type { Place } from "@/lib/repositories/types";
import { apiFetch, apiUpload } from "./fetcher";
import { queryKeys } from "./keys";
import { LOGO_KEYS, PHOTO_KEYS, mergePlaceFields } from "./place-cache";

/**
 * The photo gallery, saved as one thing.
 *
 * There were three hooks here — add, remove and reorder — each firing the moment
 * its control was pressed. They are gone, folded into the one below, because the
 * gallery is no longer three controls that each write: it is a draft the place
 * form saves with everything else (`photo-gallery-field.tsx`). Keeping them as
 * separate exports would have left three ways to write the gallery, two of them
 * bypassing the dialog's own Save.
 *
 * Every request still returns the updated place, so the cache is patched from
 * the server's own row rather than from a guess about what the new URLs will be
 * — and a removal that promoted the next photo to cover is reflected without
 * this file having to know that rule.
 */
/**
 * The whole gallery, saved in one go, from a draft.
 *
 * The place form holds photos as `PhotoSlot[]` until the user presses Save — see
 * `photo-gallery-field.tsx` — so this is where a list of "what it should look
 * like" becomes calls to the three endpoints that each do one thing. No new
 * route and no repository change: adding, dropping and reordering are already
 * the only three writes the gallery has, and each keeps its own storage
 * bookkeeping.
 *
 * The order of the three stages is not arrangeable.
 *
 * **Removals first**, because the cap is checked against what the row currently
 * holds — swapping the eighth photo would otherwise be refused for being a
 * ninth. And *sequentially*: `removePlacePhoto` reads the row, filters it and
 * writes it back, so two in parallel both compute their `kept` list from the
 * same starting state and the second write puts the first one's photo back.
 *
 * **Additions second**, in one request — the route reads `getAll("photo")`, so
 * four photos are one round trip. `addPlacePhotos` appends, so the trailing ids
 * of the place it returns are the new ones, in the order the files were sent.
 *
 * **The reorder last**, because that append ignores where the user actually put
 * them, and only when the result differs from what the server just returned. The
 * repository rejects anything that is not a permutation, so this can never
 * become a fourth way to write the gallery.
 *
 * `onPlace` fires after each stage that produced a row, and the caller uses it to
 * rewrite its slots. That is what makes a retry safe rather than duplicating: if
 * the upload lands and the reorder then fails, the files are already `saved`
 * slots, so pressing Save again uploads nothing. Re-issued deletes are a
 * documented no-op, so the removals are idempotent on their own.
 */
export function useSavePlacePhotos(mapId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      placeId,
      slots,
      savedIds,
      onPlace,
    }: {
      placeId: string;
      slots: PhotoSlot[];
      /** What the row held when the dialog opened. */
      savedIds: readonly string[];
      /**
       * Called after **every** stage that wrote a row, not just at the end.
       *
       * This is what makes a retry safe rather than duplicating. The caller
       * rebuilds its slots from the row each time, so if the upload lands and
       * the reorder then fails, the files it just sent are already `saved`
       * slots — pressing Save again reorders and uploads nothing. Waiting for
       * the return value would report none of that, because a throw means there
       * is no return value.
       */
      onPlace?: (place: Place) => void;
    }): Promise<Place | null> => {
      const { removals, uploads } = planPhotoSave(slots, savedIds);
      const report = onPlace ?? (() => {});

      let place: Place | null = null;

      /*
       * What the row holds right now, tracked across the stages rather than read
       * off `place` at the end — because `place` is null until something has
       * actually been written, and "Make cover, save" is exactly the case where
       * nothing has. Reading the order off it returned early and silently
       * discarded the only change the user had made.
       */
      let current: readonly string[] = savedIds;

      for (const photoId of removals) {
        place = (
          await apiFetch<{ place: Place }>(
            `/api/maps/${mapId}/places/${placeId}/photos/${photoId}`,
            { method: "DELETE" },
          )
        ).place;
        current = place.photoIds;
        report(place);
      }

      const added: string[] = [];

      if (uploads.length > 0) {
        const body = new FormData();
        for (const file of uploads) body.append("photo", file);

        place = (
          await apiUpload<{ place: Place }>(
            `/api/maps/${mapId}/places/${placeId}/photos`,
            body,
          )
        ).place;

        added.push(
          ...place.photoIds.slice(place.photoIds.length - uploads.length),
        );
        current = place.photoIds;
        report(place);
      }

      const desired = desiredOrder(slots, added);

      if (!sameOrder(desired, current)) {
        place = (
          await apiFetch<{ place: Place }>(
            `/api/maps/${mapId}/places/${placeId}/photos`,
            { method: "PATCH", body: JSON.stringify({ photoIds: desired }) },
          )
        ).place;
        report(place);
      }

      // Null only when the gallery was never touched — no delete, no upload and
      // an order that already matched. Nothing to patch into the cache.
      return place;
    },
    onSuccess: (place) => {
      if (place) patchPlace(queryClient, mapId, place);
    },
  });
}

/**
 * This location's own brand mark, uploaded or cleared.
 *
 * Lives beside the gallery rather than in a file of its own because it is the
 * same machinery — a multipart POST, a public storage file, a reply carrying the
 * whole row — and the one thing a reader has to compare it against is
 * `useSavePlacePhotos` directly above.
 *
 * There is no draft stage and no plan: a logo is one file, so "what it should
 * look like" is either a `File` to send or `null` to clear, and both are one
 * request. `undefined` is the third answer and the common one — the form was
 * saved without anybody touching the logo — which writes nothing at all.
 */
export function useSavePlaceLogo(mapId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      placeId,
      logo,
    }: {
      placeId: string;
      /** A file to upload, `null` to clear, `undefined` to leave alone. */
      logo: File | null | undefined;
    }): Promise<Place | null> => {
      if (logo === undefined) return null;

      const url = `/api/maps/${mapId}/places/${placeId}/logo`;

      if (logo === null) {
        return (await apiFetch<{ place: Place }>(url, { method: "DELETE" }))
          .place;
      }

      const body = new FormData();
      body.append("logo", logo);

      return (await apiUpload<{ place: Place }>(url, body)).place;
    },
    onSuccess: (place) => {
      if (place) patchPlace(queryClient, mapId, place, LOGO_KEYS);
    },
  });
}

/**
 * These endpoints change the photos or the logo and nothing else, so only those
 * fields are taken from the reply. Replacing the whole row let an upload land on top of
 * an address the reverse geocoder had written a moment earlier, and revert it —
 * the same defect described in lib/query/place-cache.ts.
 */
function patchPlace(
  queryClient: ReturnType<typeof useQueryClient>,
  mapId: string,
  place: Place,
  keys: readonly (keyof Place)[] = PHOTO_KEYS,
): void {
  queryClient.setQueryData<Place[]>(
    queryKeys.places.list(mapId),
    (places = []) =>
      places.map((existing) =>
        existing.id === place.id
          ? mergePlaceFields(existing, place, keys)
          : existing,
      ),
  );
}
