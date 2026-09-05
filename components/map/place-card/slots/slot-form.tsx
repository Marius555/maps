"use client";

import type { CardSlot } from "@/lib/card/card-slots";
import type { AppMap, Place } from "@/lib/repositories/types";
import { slotTitle } from "./slot-labels";
import { SlotAddressForm } from "./slot-address-form";
import { SlotFieldForm } from "./slot-field-form";
import { SlotHoursForm } from "./slot-hours-form";
import { SlotLogoForm } from "./slot-logo-form";
import { SlotPhotosForm } from "./slot-photos-form";
import { SlotTagsForm } from "./slot-tags-form";
import { SlotTextForm } from "./slot-text-form";

/**
 * Which form a slot opens.
 *
 * The whole of the branching, in one switch, so every body below is only its own
 * fields — and so that adding a slot kind to `CardSlot` fails to compile here
 * until it has somewhere to go.
 *
 * `onDone` is both Save-succeeded and Cancel, deliberately: what closes the
 * popover is the same in either case, and the card behind it repaints on its own
 * because `useUpdatePlace` is optimistic. There is nothing for this to tell the
 * card about.
 */
export function SlotForm({
  map,
  place,
  slot,
  onDone,
}: {
  map: AppMap;
  place: Place;
  slot: CardSlot;
  onDone: () => void;
}) {
  const title = slotTitle(slot);

  switch (slot.kind) {
    case "photos":
      return (
        <SlotPhotosForm mapId={map.id} place={place} title={title} onDone={onDone} />
      );

    case "tags":
      return <SlotTagsForm map={map} place={place} title={title} onDone={onDone} />;

    case "address":
      return (
        <SlotAddressForm mapId={map.id} place={place} title={title} onDone={onDone} />
      );

    case "hours":
      return (
        <SlotHoursForm mapId={map.id} place={place} title={title} onDone={onDone} />
      );

    case "logo":
      return (
        <SlotLogoForm mapId={map.id} place={place} title={title} onDone={onDone} />
      );

    case "field": {
      const field = map.fields.find((candidate) => candidate.id === slot.fieldId);

      // `cardSlotOf` only ever names a field this map has, so this is a guard
      // rather than a case — the map could have changed under an open popover.
      if (!field) return null;

      return (
        <SlotFieldForm
          mapId={map.id}
          place={place}
          field={field}
          title={title}
          onDone={onDone}
        />
      );
    }

    /*
     * The four that are boxes of text. The Links row asks for up to three at
     * once and shows only the ones its owner left switched on — which is why
     * `CardSlot` carries those three booleans rather than the block.
     */
    case "name":
      return (
        <SlotTextForm
          mapId={map.id}
          place={place}
          title={title}
          inputs={[{ name: "name", label: "Name" }]}
          onDone={onDone}
        />
      );

    case "description":
      return (
        <SlotTextForm
          mapId={map.id}
          place={place}
          title={title}
          inputs={[{ name: "description", label: "Description", multiline: true }]}
          onDone={onDone}
        />
      );

    case "url":
      return (
        <SlotTextForm
          mapId={map.id}
          place={place}
          title={title}
          inputs={[{ name: "url", label: "Website", type: "url" }]}
          onDone={onDone}
        />
      );

    case "contact":
      return (
        <SlotTextForm
          mapId={map.id}
          place={place}
          title={title}
          inputs={[
            ...(slot.phone
              ? [{ name: "phone" as const, label: "Phone", type: "tel" as const }]
              : []),
            ...(slot.email
              ? [{ name: "email" as const, label: "Email", type: "email" as const }]
              : []),
            ...(slot.website
              ? [{ name: "url" as const, label: "Website", type: "url" as const }]
              : []),
          ]}
          onDone={onDone}
        />
      );
  }
}
