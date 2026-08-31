"use client";

import { Button, Tooltip } from "@heroui/react";
import { X } from "lucide-react";

import { PlaceStatusFlag } from "@/components/places/place-status-flag";
import type { Place } from "@/lib/repositories/types";

/**
 * The parts of the editor's card that are ours, not the owner's.
 *
 * A close button and an "Edit location" footer are dashboard affordances: they
 * do not exist on a visitor's card and must not be things the designer can move,
 * resize or delete. Keeping them outside the layout is what stops someone
 * building a card with a giant X across the middle of it, and it is also why
 * they cannot be block types.
 *
 * The geocode flag is here for the same reason. It says how confident we are
 * about a pin's position, which is a fact about our own import pipeline — a
 * visitor has no use for it and never sees it.
 */
export function PlaceCardChrome({
  place,
  onClose,
  onEdit,
}: {
  place: Place;
  onClose: () => void;
  onEdit?: (placeId: string) => void;
}) {
  /*
   * Only the two statuses that ask for something. `isApproximate` — a pin the
   * owner dropped themselves, whose address came back as a street rather than a
   * building — is a note about the *address*, and the card is already showing
   * that address a few lines above: repeating it as an unlabelled amber mark
   * under an Edit button said nothing the card did not already say, and read as
   * a warning about the pin, which is the one thing that is right. It stays in
   * the sidebar and the table, where the address is not on screen.
   */
  const flagged =
    place.geocodeStatus === "failed" || place.geocodeStatus === "low";

  return (
    <>
      {/*
       * Over the card rather than in it, because the top of the card may be a
       * photo that reaches the edges — a close button in the flow would push it
       * down and put a white band above someone's picture. The backdrop is what
       * keeps it legible on whatever it lands on.
       *
       * A HeroUI `Button` wearing those two jobs rather than `IconButton`: this
       * one has to be translucent over an arbitrary photo and sit at a size no
       * toolbar button is, and `IconButton` exists to make every *toolbar*
       * button identical. What it is borrowed for is the Tooltip — the label was
       * only ever in `aria-label`, so a sighted user got an unexplained X, which
       * is exactly the failure `IconButton` was written to stop.
       */}
      <Tooltip delay={0}>
        <Button
          aria-label="Close"
          isIconOnly
          size="sm"
          variant="tertiary"
          onPress={onClose}
          className="absolute top-1.5 right-1.5 z-10 size-7 min-w-0 rounded-lg bg-surface/80 text-muted backdrop-blur-sm hover:bg-default hover:text-foreground"
        >
          <X aria-hidden="true" className="size-4" />
        </Button>
        <Tooltip.Content placement="left">Close</Tooltip.Content>
      </Tooltip>

      {flagged || onEdit ? (
        <div className="shrink-0 space-y-2 border-t border-border p-2">
          {flagged ? (
            // The chip, not the ring: the ring is the compromise a 320px
            // sidebar forces, and a card footer has room for the word.
            <PlaceStatusFlag status={place.geocodeStatus} variant="chip" />
          ) : null}

          {onEdit ? (
            <Button
              size="sm"
              variant="tertiary"
              fullWidth
              onPress={() => onEdit(place.id)}
            >
              Edit location
            </Button>
          ) : null}
        </div>
      ) : null}
    </>
  );
}
