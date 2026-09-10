"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { Button, Modal } from "@heroui/react";
import { useState } from "react";
import { useForm, useWatch } from "react-hook-form";

import { ErrorMessage } from "@/components/ui/error-message";
import { applyFieldErrors } from "@/lib/query/form-errors";
import { useSavePlaceLogo, useSavePlacePhotos } from "@/lib/query/photo";
import { useUpdatePlace } from "@/lib/query/places";
import type { AppMap, Place } from "@/lib/repositories/types";
import {
  placeFormSchema,
  type PlaceFormValues,
} from "@/lib/validation/place.schema";
import type { PhotoSlot } from "@/lib/photos/save-plan";
import { emptyHours } from "@/packages/shared/hours";
import type { LogoDraft } from "./logo-field";
import { ContactSection } from "./sections/contact-section";
import { CoordinatesSection } from "./sections/coordinates-section";
import { EssentialsSection } from "./sections/essentials-section";
import { FieldsSection } from "./sections/fields-section";
import { FormSectionGroup } from "./sections/form-section-group";
import { HoursSection } from "./sections/hours-section";
import { MediaSection } from "./sections/media-section";

/**
 * Edits one location.
 *
 * Composition and submit; every field lives in a section beside it. What used to
 * be here was one flat stack of eleven controls in a 520px dialog, which is the
 * form the user could not make sense of — nothing separated the four fields that
 * decide whether this is a working pin from the seven that decorate it.
 *
 * **Coordinates are typed now, and that is a deliberate reversal.** This file
 * used to say "Coordinates are shown but not typed: nobody edits a latitude by
 * hand", and mostly nobody does — but the exception is the case that matters,
 * which is a pin the geocoder put in the wrong country. Then the coordinates are
 * the only way in, and the advice this form gave instead ("drag the pin on the
 * map") pointed at a map that did not exist in the dialog. There is one now, and
 * the boxes underneath it, and either can move the pin.
 *
 * **Everything in here is a draft, including the pictures.** Photos were the one
 * exception — uploaded the moment they were picked, so Cancel did not undo them
 * and Save did not save them. They are `PhotoSlot`s in local state now, held
 * beside the form rather than inside it because a `File` has no business in a
 * zod schema, and written by `useSavePlacePhotos` on submit. The logo is a
 * `LogoDraft` on exactly those terms.
 */
export function PlaceForm({
  map,
  place,
  onSaved,
  onCancel,
}: {
  map: AppMap;
  place: Place;
  onSaved?: () => void;
  onCancel?: () => void;
}) {
  const updatePlace = useUpdatePlace(map.id);
  const savePhotos = useSavePlacePhotos(map.id);
  const saveLogo = useSavePlaceLogo(map.id);

  /*
   * The gallery, as it will be. Seeded from the saved row, and reset with the
   * rest of the form by the `key` the dialog puts on this component.
   */
  const [photos, setPhotos] = useState<PhotoSlot[]>(() => galleryOf(place));

  /*
   * The logo, as it will be — and `logoOf` rather than a bare initialiser so
   * "what the row holds" is spelled once, the way `galleryOf` already is.
   */
  const [logo, setLogo] = useState<LogoDraft>(() => logoOf(place));

  const {
    handleSubmit,
    control,
    setError,
    setValue,
    formState: { errors, isSubmitting },
  } = useForm<PlaceFormValues>({
    resolver: zodResolver(placeFormSchema),
    defaultValues: {
      name: place.name,
      address: place.address,
      tags: place.tags,
      fields: place.fields,
      icon: place.icon,
      description: place.description ?? "",
      phone: place.phone ?? "",
      email: place.email ?? "",
      url: place.url ?? "",
      // The form always holds seven days; `null` on the place means none set yet.
      hours: place.hours ?? emptyHours(),
      lat: place.lat,
      lng: place.lng,
    },
  });

  // useWatch, not watch(): watch() returns a fresh function each render, which
  // the React Compiler can't memoize, so it opts the whole component out.
  const lat = useWatch({ control, name: "lat" });
  const lng = useWatch({ control, name: "lng" });
  // Watched for the map above, which draws the draft rather than the saved row.
  const icon = useWatch({ control, name: "icon" });

  /*
   * Moved up out of the essentials, because two sections write the position now:
   * the map and the boxes under "Coordinates". One setter, so a drag and a typed
   * number cannot mark the form dirty in different ways.
   */
  const setPosition = (coords: { lat: number; lng: number }) => {
    setValue("lat", coords.lat, { shouldDirty: true });
    setValue("lng", coords.lng, { shouldDirty: true });
  };

  /*
   * The fields first, then the photos.
   *
   * Both have to happen, and one of them can fail — so the question is which
   * order leaves a recoverable dialog. The field PATCH is idempotent, so a photo
   * failure leaves a form that can simply be saved again; the reverse would
   * leave uploaded photos behind a PATCH that never ran, with nothing on screen
   * saying which half landed.
   */
  const onSubmit = handleSubmit(async (values) => {
    try {
      await updatePlace.mutateAsync({
        placeId: place.id,
        input: {
          ...values,
          // Coordinates set here were placed deliberately — by drag, by typing,
          // or by picking a match — so a later geocode pass must not overwrite
          // them.
          geocodeStatus:
            values.lat === place.lat && values.lng === place.lng
              ? place.geocodeStatus
              : "manual",
        },
      });

      await savePhotos.mutateAsync({
        placeId: place.id,
        slots: photos,
        savedIds: place.photoIds,
        // Every stage, not just the last one — see the hook. A file that has
        // been uploaded stops being a pending file immediately, so a failure
        // further along leaves a Save that can be pressed again without sending
        // it twice.
        onPlace: (written) => setPhotos(galleryOf(written)),
      });

      /*
       * Last, and only when it changed — `logoRequest` answers `undefined` for
       * the common case, which is a form saved without anybody touching it, and
       * the hook makes no request at all for that.
       *
       * After the photos rather than before, on the same argument the two above
       * are ordered by: this is the cheapest half to repeat, so it is the one
       * that should be left outstanding if something fails earlier.
       */
      const written = await saveLogo.mutateAsync({
        placeId: place.id,
        logo: logoRequest(logo, place),
      });

      // Same reason the gallery resyncs: an uploaded file stops being a pending
      // file at once, so a retry sends nothing twice.
      if (written) setLogo(logoOf(written));

      onSaved?.();
    } catch (error) {
      applyFieldErrors(error, setError);
    }
  });

  return (
    /*
     * The form is the dialog's body *and* its footer, which is what keeps the
     * buttons still.
     *
     * They used to sit at the end of one `space-y-4` stack inside `Modal.Body`,
     * and `Modal.Body` is the scroller: HeroUI's modal defaults to
     * `scroll: "inside"`, so `.modal__body--scroll-inside` takes the overflow
     * while `.modal__dialog` is held at `max-h-full` and centred by
     * `sm:my-auto`. Closing the **last** fold — Media, the only one with the
     * buttons directly beneath it — then did two ugly things in sequence.
     * React Aria's `useDisclosure` collapse pins `--disclosure-panel-height` to
     * the measured `scrollHeight`, forces a reflow and animates it to `0px`, so
     * for 200ms the buttons were dragged up the scroller by the browser's own
     * scroll anchoring; and the moment the content stopped overflowing, the
     * scroller's `scrollTop` collapsed and the dialog re-centred, which is the
     * jump at the end that no transition covered.
     *
     * Header, body and footer are siblings in a `flex-col` dialog held at
     * `max-h-full`, so only the body — the one with `flex-1` — takes the
     * overflow. That is the arrangement `components/map/pin-studio/pin-studio.tsx`
     * already documents; the form has to *span* the two of them so submit still
     * works from a button that is no longer inside the scrolling half, which is
     * why it carries the dialog's own flex column rather than a `form=`
     * attribute and a lifted `isSubmitting`.
     *
     * `mt-2` is what `.modal__header + .modal__body` used to give the body for
     * free; with this element between them the adjacency no longer matches.
     */
    <form
      onSubmit={onSubmit}
      className="mt-2 flex min-h-0 flex-1 flex-col"
      noValidate
    >
      <Modal.Body className="space-y-4">
        {updatePlace.error ? <ErrorMessage error={updatePlace.error} /> : null}
        {savePhotos.error ? <ErrorMessage error={savePhotos.error} /> : null}
        {saveLogo.error ? <ErrorMessage error={saveLogo.error} /> : null}

        <EssentialsSection
          map={map}
          place={place}
          control={control}
          errors={errors}
          lat={lat}
          lng={lng}
          icon={icon}
          onMove={setPosition}
        />

        {/* Collapsed by default, one open at a time, and forced open by an error
            in them — a message nobody can see is the same as no message. */}
        <FormSectionGroup className="space-y-2">
          {/* First of the folds, because it is the one that belongs to the map
              directly above it — but folded, because it is the rare repair
              rather than a field anybody fills in. */}
          <CoordinatesSection lat={lat} lng={lng} onChange={setPosition} />

          <ContactSection
            control={control}
            hasError={Boolean(errors.phone || errors.email || errors.url)}
          />
          {/* Tags are not here any more: they moved up into Essentials, where
              the Category select used to be. They are what says what kind of
              place this is, and a fold is not where that question belongs. */}
          <FieldsSection control={control} fields={map.fields} />
          <HoursSection control={control} hasError={Boolean(errors.hours)} />
          <MediaSection
            logo={logo}
            photos={photos}
            control={control}
            hasError={Boolean(errors.description)}
            onLogoChange={setLogo}
            onPhotosChange={setPhotos}
          />
        </FormSectionGroup>
      </Modal.Body>

      {/* `.modal__footer` is already `flex flex-row items-center justify-end
          gap-2`, and `.modal__body + .modal__footer` pays the 20px above it, so
          the row keeps exactly the shape it had as a hand-built div. */}
      <Modal.Footer>
        {onCancel ? (
          <Button variant="tertiary" onPress={onCancel}>
            Cancel
          </Button>
        ) : null}
        <Button type="submit" isPending={isSubmitting}>
          Save changes
        </Button>
      </Modal.Footer>
    </form>
  );
}

/**
 * A stored row's photos as gallery slots.
 *
 * Shared by the initial state and the resync during a save, so "what the row
 * holds" is spelled once — two copies would be two chances for the saved gallery
 * and the drafted one to disagree about their own shape.
 */
function galleryOf(place: Place): PhotoSlot[] {
  return place.photoIds.map((id, index) => ({
    kind: "saved",
    id,
    url: place.photoUrls[index],
  }));
}

/** A stored row's logo as a draft. `galleryOf`'s single-valued twin. */
function logoOf(place: Place): LogoDraft {
  return place.logoUrl ? { kind: "saved", url: place.logoUrl } : null;
}

/**
 * What to send for the logo: a file, `null` to clear, or `undefined` to leave it
 * alone.
 *
 * The third answer is the one worth having, and it is why this is a function
 * rather than a value read off the draft. A draft that is still the `saved` slot
 * it started as means nobody touched the control, and a request there would be a
 * delete-and-reupload of a file that has not changed — or, worse, a DELETE for a
 * location that never had one, on every single save.
 */
function logoRequest(logo: LogoDraft, place: Place): File | null | undefined {
  if (logo?.kind === "new") return logo.file;
  if (!logo && place.logoId) return null;

  return undefined;
}
