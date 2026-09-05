"use client";

import { useState } from "react";

import {
  LogoField,
  type LogoDraft,
} from "@/components/places/place-form/logo-field";
import { useSavePlaceLogo } from "@/lib/query/photo";
import type { Place } from "@/lib/repositories/types";
import { SlotShell } from "./slot-shell";

/**
 * This location's own brand mark, in the popover.
 *
 * `SlotPhotosForm`'s sibling in every respect that matters: an upload rather
 * than a column, so it goes through `useSavePlaceLogo` instead of
 * `useUpdatePlace`, and it is genuinely slow — the pending state on Add is doing
 * real work rather than covering a round trip nobody sees.
 *
 * `LogoField` unchanged from the Edit dialog's, which is the point: the slot is
 * a second door onto the same field, not a second version of it.
 *
 * Only ever reached from a Logo block set strictly to **Logo** — see
 * `cardSlotOf`. On Pin or Mixed the block draws the pin, which is content, so
 * there is nothing here to offer.
 */
export function SlotLogoForm({
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
  const saveLogo = useSavePlaceLogo(mapId);
  const [logo, setLogo] = useState<LogoDraft>(null);

  const submit = async () => {
    // The slot is only drawn over a location with no logo, so the only thing
    // worth sending is a newly picked file — there is nothing here to clear.
    if (logo?.kind !== "new") return;

    try {
      await saveLogo.mutateAsync({ placeId: place.id, logo: logo.file });
      onDone();
    } catch {
      // Rendered from the mutation's own error below.
    }
  };

  return (
    <SlotShell
      title={title}
      error={saveLogo.error}
      isPending={saveLogo.isPending}
      isDisabled={logo?.kind !== "new"}
      onSubmit={() => void submit()}
      onCancel={onDone}
    >
      <LogoField value={logo} onChange={setLogo} />
    </SlotShell>
  );
}
