"use client";

import { useState } from "react";

import { HoursField } from "@/components/places/place-form/hours-field/hours-field";
import { useUpdatePlace } from "@/lib/query/places";
import type { Place } from "@/lib/repositories/types";
import { emptyHours, isEmptyHours, type OpeningHours } from "@/packages/shared/hours";
import { SlotShell } from "./slot-shell";

/**
 * The week, in the popover.
 *
 * `HoursField` unchanged — it is seven rows of switches and time inputs,
 * which is exactly what the dialog shows and the one control here that would be
 * genuinely painful to have two versions of. It is the reason the popover is a
 * popover rather than something drawn inside the block: seven rows do not fit in
 * a card block, and a location with no hours is precisely the one whose block is
 * a single empty line.
 *
 * Not react-hook-form: `HoursField` is a value/onChange control over a
 * seven-element array, which is what `PlaceForm` binds through a `Controller`
 * only because the rest of that form is RHF. Here there is nothing else in the
 * form to share a resolver with, and the server parses the array either way.
 */
export function SlotHoursForm({
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
  const updatePlace = useUpdatePlace(mapId);
  // The form always holds seven days; `null` on the place means none set yet.
  const [hours, setHours] = useState<OpeningHours>(place.hours ?? emptyHours());

  const submit = async () => {
    try {
      await updatePlace.mutateAsync({ placeId: place.id, input: { hours } });
      onDone();
    } catch {
      // Rendered from the mutation's own error below.
    }
  };

  return (
    <SlotShell
      title={title}
      error={updatePlace.error}
      isPending={updatePlace.isPending}
      // An all-closed week is the same as no week — it is what the block is
      // already drawing — so there is nothing to add until a day is opened.
      isDisabled={isEmptyHours(hours)}
      onSubmit={() => void submit()}
      onCancel={onDone}
    >
      <HoursField value={hours} onChange={setHours} />
    </SlotShell>
  );
}
