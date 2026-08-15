"use client";

import { Button, Drawer, Modal } from "@heroui/react";
import { Plus } from "lucide-react";
import { useMemo, useState } from "react";

import { ErrorMessage } from "@/components/ui/error-message";
import { useUpdateMap } from "@/lib/query/maps";
import type { AppMap, Place } from "@/lib/repositories/types";
import { SM_BREAKPOINT, useMediaQuery } from "@/lib/ui/use-media-query";
import { CATEGORY_COLORS } from "@/lib/validation/category.schema";
import { MAX_PIN_ICONS, pinIconsSchema } from "@/lib/validation/pin-icon.schema";
import { CUSTOM_PIN_PREFIX, type CustomPinIcon } from "@/packages/shared/pin-icons";
import { PinBuilder } from "./pin-builder";
import { PinLibrary } from "./pin-library";

/**
 * The pin studio: pick a pin, or make one.
 *
 * A dialog on a desktop and a bottom sheet on a phone, which is not a style
 * choice — a centred modal on a 360px screen is a full-screen takeover with
 * rounded corners, and a sheet you can flick away is how every app that screen
 * has ever run behaves. HeroUI's Drawer already *is* that sheet: it defaults to
 * `placement="bottom"` and ships the drag-to-dismiss, so this needs no gesture
 * code of its own, and `Drawer.Handle` is the grab bar that says so.
 *
 * One of the two is rendered, never both. They are separate React Aria overlays
 * with separate focus traps, so rendering both and hiding one with CSS would put
 * two of them in the DOM — which is why this reaches for `useMediaQuery` where
 * the rest of the app is happy with a Tailwind prefix.
 *
 * Two views, one sheet. The library is what opens; the builder replaces it and
 * hands back. A second dialog stacked on the first would be two backdrops and a
 * back button nobody expects on a phone.
 *
 * Saving goes through the map's own PATCH, because a pin is map data exactly as a
 * category is — the image is already a small string by the time it gets here
 * (lib/map/normalise-pin-image.ts), so there is no upload and no second endpoint.
 */
export function PinStudio({
  map,
  places,
  isOpen,
  onOpenChange,
  onPick,
}: {
  map: AppMap;
  places: Place[];
  isOpen: boolean;
  onOpenChange: (isOpen: boolean) => void;
  /** Arms add mode with the chosen pin. Closing is this component's business. */
  onPick: (icon: string) => void;
}) {
  const isWide = useMediaQuery(SM_BREAKPOINT);
  const updateMap = useUpdateMap(map.id);
  const [draft, setDraft] = useState<CustomPinIcon | null>(null);
  const [problem, setProblem] = useState<string | null>(null);

  const pinIcons = map.pinIcons;

  const usageByPin = useMemo(() => {
    const counts = new Map<string, number>();

    for (const place of places) {
      if (!place.icon.startsWith(CUSTOM_PIN_PREFIX)) continue;

      const id = place.icon.slice(CUSTOM_PIN_PREFIX.length);
      counts.set(id, (counts.get(id) ?? 0) + 1);
    }

    return counts;
  }, [places]);

  const close = () => {
    onOpenChange(false);
    // Reset on the way out rather than on the way in: a sheet that reopened
    // mid-edit would be showing a form the user thought they had dismissed.
    setDraft(null);
    setProblem(null);
  };

  const pick = (icon: string) => {
    onPick(icon);
    close();
  };

  /** Whole-array writes, because the column is one JSON blob either way. */
  const commit = async (next: CustomPinIcon[], picked?: string) => {
    setProblem(null);

    const parsed = pinIconsSchema.safeParse(next);
    if (!parsed.success) {
      setProblem(parsed.error.issues[0]?.message ?? "Check the pin and try again.");
      return;
    }

    try {
      await updateMap.mutateAsync({ pinIcons: parsed.data });
    } catch {
      // Rendered from the mutation's own error below.
      return;
    }

    // Straight to using the pin that was just made. Going back to a library to
    // press the thing you were already looking at is a step for its own sake.
    if (picked) pick(picked);
    else setDraft(null);
  };

  const save = () => {
    if (!draft) return;

    const exists = pinIcons.some((pin) => pin.id === draft.id);
    const next = exists
      ? pinIcons.map((pin) => (pin.id === draft.id ? draft : pin))
      : [...pinIcons, draft];

    // An edit stays in the library; a new pin is what you came here to use.
    void commit(next, exists ? undefined : `${CUSTOM_PIN_PREFIX}${draft.id}`);
  };

  const remove = () => {
    if (!draft) return;

    // The places wearing it keep rendering — as plain pins — until the server
    // clears their icon, which maps.repository does in the same request.
    void commit(pinIcons.filter((pin) => pin.id !== draft.id));
  };

  const body = (
    <div className="flex flex-col gap-4">
      {problem ? <ErrorMessage error={problem} /> : null}
      {updateMap.error ? <ErrorMessage error={updateMap.error} /> : null}

      {draft ? (
        <PinBuilder
          draft={draft}
          usageCount={usageByPin.get(draft.id) ?? 0}
          isSaving={updateMap.isPending}
          isExisting={pinIcons.some((pin) => pin.id === draft.id)}
          onChange={setDraft}
          onSave={save}
          onDelete={remove}
          onCancel={() => setDraft(null)}
        />
      ) : (
        <PinLibrary
          pinIcons={pinIcons}
          usageByPin={usageByPin}
          onPick={pick}
          onEdit={setDraft}
        />
      )}
    </div>
  );

  const heading = draft
    ? pinIcons.some((pin) => pin.id === draft.id)
      ? "Edit pin"
      : "New pin"
    : "Pins";

  /**
   * Making a pin is the reason to be here, so it sits in the title row rather
   * than buried in a section header — and only in the library, where the builder
   * it opens isn't already on screen saying "New pin" at the top.
   */
  const action = draft ? null : (
    <Button
      size="sm"
      variant="secondary"
      isDisabled={pinIcons.length >= MAX_PIN_ICONS}
      onPress={() => setDraft(blankPin(pinIcons))}
    >
      <Plus aria-hidden="true" className="size-4" />
      New pin
    </Button>
  );

  if (isWide) {
    return (
      <Modal.Backdrop isOpen={isOpen} onOpenChange={(open) => !open && close()}>
        <Modal.Container>
          <Modal.Dialog className="sm:max-w-[520px]">
            <Modal.CloseTrigger />
            {/* `pe-10` keeps the action clear of the close trigger, which is
                positioned over this row rather than laid out in it. The row
                itself is an inner div because `.modal__header` sets `flex-col`
                as an unlayered rule, which a `flex-row` utility would lose to. */}
            <Modal.Header className="pe-10">
              <div className="flex items-center justify-between gap-2">
                <Modal.Heading>{heading}</Modal.Heading>
                {action}
              </div>
            </Modal.Header>
            <Modal.Body>{body}</Modal.Body>
          </Modal.Dialog>
        </Modal.Container>
      </Modal.Backdrop>
    );
  }

  return (
    <Drawer.Backdrop isOpen={isOpen} onOpenChange={(open) => !open && close()}>
      {/* Capped so the sheet never covers the whole screen — a strip of map left
          showing is what makes it read as a sheet over something rather than as a
          new page. */}
      <Drawer.Content placement="bottom" className="max-h-[85dvh]">
        <Drawer.Dialog className="flex max-h-[85dvh] flex-col">
          {/* The grab bar. Drawer's drag handling deliberately ignores presses
              that start inside the body, so without this there is nothing on the
              sheet you can actually pull. */}
          <Drawer.Handle />
          <Drawer.Header>
            <div className="flex items-center justify-between gap-2">
              <Drawer.Heading className="text-sm font-semibold">
                {heading}
              </Drawer.Heading>
              {action}
            </div>
          </Drawer.Header>
          <Drawer.Body className="min-h-0 flex-1 overflow-y-auto">{body}</Drawer.Body>
        </Drawer.Dialog>
      </Drawer.Content>
    </Drawer.Backdrop>
  );
}

/**
 * A pin that already looks like something.
 *
 * An empty form asks the user to imagine the result; this one is a working pin
 * from the first frame, and every control changes something visible. The colour
 * steps through the palette so a second pin never arrives identical to the first.
 */
function blankPin(existing: CustomPinIcon[]): CustomPinIcon {
  return {
    id: crypto.randomUUID().slice(0, 8),
    label: "",
    color: CATEGORY_COLORS[existing.length % CATEGORY_COLORS.length],
    glyph: "store",
    image: "",
  };
}
