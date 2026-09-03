"use client";

import { Button, Drawer, Modal } from "@heroui/react";
import { Plus, Trash2 } from "lucide-react";
import { useMemo, useState } from "react";

import { ErrorMessage } from "@/components/ui/error-message";
import { IconButton } from "@/components/ui/icon-button";
import { useUpdateMap } from "@/lib/query/maps";
import type { AppMap, Place } from "@/lib/repositories/types";
import { SM_BREAKPOINT, useMediaQuery } from "@/lib/ui/use-media-query";
import { PALETTE_COLORS } from "@/lib/validation/palette";
import { MAX_PIN_ICONS, pinIconsSchema } from "@/lib/validation/pin-icon.schema";
import { CUSTOM_PIN_PREFIX, type CustomPinIcon } from "@/packages/shared/pin-icons";
import { PinActions } from "./pin-actions";
import { PinFields } from "./pin-fields";
import { PinHero } from "./pin-hero";
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
 * The builder is not one component but three, because the dialog has three slots
 * and the pieces have to sit in different ones: PinHero in the header, PinFields
 * in the body, PinActions in the footer. Only the middle one scrolls — see the
 * note on `Modal.Container` below for why that arrangement is the point rather
 * than an accident of composition.
 *
 * Every press in the library lands in the builder — see PinLibrary for why — so
 * the builder is where a pin gets used as well as made. Saving arms add mode with
 * it and closes, for both a new pin and an edited one. That is one action rather
 * than two ("save", then find the thing you just saved and press it again), and
 * it is why the primary button is "Use pin" in both cases: an action keeps its
 * name through the whole flow (§8).
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

    // Straight to using the pin that was just saved. Going back to a library to
    // press the thing you were already looking at is a step for its own sake.
    if (picked) pick(picked);
    else setDraft(null);
  };

  /** Editing one of the map's own pins, rather than making a new one. */
  const isEditing = draft !== null && pinIcons.some((pin) => pin.id === draft.id);

  const save = () => {
    if (!draft) return;

    const next = isEditing
      ? pinIcons.map((pin) => (pin.id === draft.id ? draft : pin))
      : [...pinIcons, draft];

    // New or edited, the pin you just finished is the one you want to drop.
    void commit(next, `${CUSTOM_PIN_PREFIX}${draft.id}`);
  };

  const remove = () => {
    if (!draft) return;

    // The places wearing it keep rendering — as plain pins — until the server
    // clears their icon, which maps.repository does in the same request.
    void commit(pinIcons.filter((pin) => pin.id !== draft.id));
  };

  /**
   * The three slots the dialog is built from, filled once and handed to whichever
   * of the two shells is on screen.
   *
   * Header and footer are siblings of the body inside a dialog that is a capped
   * flex column, so whatever goes in them stays put while the body scrolls. That
   * is the whole reason the builder is three components rather than one: the pin
   * you are making has to be visible while you scroll the rows that change it,
   * and so does the button that finishes.
   */
  const hero = draft ? <PinHero draft={draft} onChange={setDraft} /> : null;

  const content = draft ? (
    <PinFields draft={draft} onChange={setDraft} />
  ) : (
    <PinLibrary
      pinIcons={pinIcons}
      usageByPin={usageByPin}
      onEdit={setDraft}
      onFork={(glyph) => setDraft({ ...blankPin(pinIcons), glyph })}
    />
  );

  // Both failures reach the user from the footer, because both come from a
  // control in it — or, for a refused delete, from a title bar that is pinned to
  // the same frame. The library has no footer and cannot raise either: nothing in
  // it writes.
  const footer = draft ? (
    <PinActions
      draft={draft}
      isSaving={updateMap.isPending}
      problem={
        <>
          {problem ? <ErrorMessage error={problem} /> : null}
          {updateMap.error ? <ErrorMessage error={updateMap.error} /> : null}
        </>
      }
      onChange={setDraft}
      onSave={save}
      onCancel={() => setDraft(null)}
    />
  ) : null;

  const heading = draft ? (isEditing ? "Edit pin" : "New pin") : "Pins";

  /**
   * The title row's own control, which is a different one in each of the three
   * states this sheet has.
   *
   * Making a pin is the reason to be in the library, so it sits in the title row
   * rather than buried in a section header — and only there, since the builder it
   * opens is already on screen saying "New pin" at the top.
   *
   * Deleting one is the same kind of thing: an action on what the sheet is
   * showing, not a way to finish the form under it. It is up here and well away
   * from Save, which it shared a row with before.
   *
   * Both sit directly *after* the heading rather than at the far end of the row.
   * They are actions on the thing the heading names — "Pins, and here is how you
   * make another" — and a control flung to the opposite edge reads as belonging
   * to the dialog's chrome, next to the close button, rather than to its subject.
   *
   * Red on the glyph rather than a `danger` variant: that variant is a solid red
   * fill, which is a lot of weight for a title bar, and HeroUI's variants set
   * `--button-fg` from unlayered CSS that a Tailwind text colour on the button
   * would lose to. On the icon it beats inheritance and needs no override.
   */
  const action = draft ? (
    isEditing ? (
      <IconButton
        label={deleteLabel(usageByPin.get(draft.id) ?? 0)}
        icon={Trash2}
        variant="ghost"
        iconClassName="size-4 text-danger"
        onPress={remove}
      />
    ) : null
  ) : (
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
        {/* `scroll="inside"` caps the dialog at the viewport and scrolls the body
            within it — seven rows of options are taller than a laptop screen.
            HeroUI's own modifier rather than an `overflow-y-auto` utility, which
            would lose to `.modal__body`'s unlayered `overflow: visible`.

            It is also what pins the hero and the footer: header, body and footer
            are siblings in a `flex-col` dialog held at `max-h-full`, so only the
            body — the one with `flex-1` — takes the overflow. Putting all three
            inside the body instead, which is where they used to be, is what made
            the pin you are designing scroll off the top of the screen. */}
        <Modal.Container scroll="inside">
          <Modal.Dialog className="sm:max-w-[520px]">
            <Modal.CloseTrigger />
            {/* `.modal__header` is an unlayered `flex-col`, which is exactly the
                stack this wants — title row, then the pin under it — so the rows
                are children of it rather than of a wrapper. The `pe-10` is on the
                title row alone and not on the header: it keeps the action clear of
                the close trigger, which is positioned over that row rather than
                laid out in it, and on the header it would drag the centred hero
                20px to the left. */}
            <Modal.Header className={hero ? "border-b border-border pb-4" : undefined}>
              <div className="flex items-center gap-2 pe-10">
                <Modal.Heading>{heading}</Modal.Heading>
                {action}
              </div>
              {hero}
            </Modal.Header>

            <Modal.Body>{content}</Modal.Body>

            {footer ? (
              <Modal.Footer className="border-t border-border pt-4">{footer}</Modal.Footer>
            ) : null}
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
          <Drawer.Header className={hero ? "border-b border-border pb-4" : undefined}>
            <div className="flex items-center gap-2">
              <Drawer.Heading className="text-sm font-semibold">{heading}</Drawer.Heading>
              {action}
            </div>
            {hero}
          </Drawer.Header>

          {/* `.drawer__body` already ships `min-h-0 flex-1` and the scrolling. */}
          <Drawer.Body>{content}</Drawer.Body>

          {footer ? (
            <Drawer.Footer className="border-t border-border pt-4">{footer}</Drawer.Footer>
          ) : null}
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
 *
 * The design fields are left off rather than written out as their defaults. They
 * are optional on the record for exactly this reason — absent *is* the default —
 * and a pin that only says what the customer actually changed is a smaller row
 * and a smaller snapshot.
 */
/**
 * The consequence of deleting, in the label.
 *
 * It rides in the accessible name and the tooltip rather than needing a line of
 * its own, which is what lets an icon-only button in a title bar carry a warning
 * at all. There is no confirmation step behind it: what it does is reversible in
 * the sense that matters — the locations stay, they go back to plain pins.
 */
function deleteLabel(usageCount: number): string {
  if (usageCount === 0) return "Delete pin";

  const places = usageCount === 1 ? "1 location" : `${usageCount} locations`;
  return `Delete pin — ${places} will go back to a plain pin`;
}

function blankPin(existing: CustomPinIcon[]): CustomPinIcon {
  return {
    id: crypto.randomUUID().slice(0, 8),
    label: "",
    color: PALETTE_COLORS[existing.length % PALETTE_COLORS.length],
    glyph: "store",
    image: "",
  };
}
