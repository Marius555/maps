"use client";

import { Button } from "@heroui/react";
import { Pencil, SlidersHorizontal, X } from "lucide-react";

import { PlaceStatusFlag } from "@/components/places/place-status-flag";
import type { Place } from "@/lib/repositories/types";

/**
 * The parts of the editor's card that are ours, not the owner's.
 *
 * A close button, an Edit button and a geocode flag are dashboard affordances:
 * they do not exist on a visitor's card and must not be things the designer can
 * move, resize or delete. Keeping them outside the layout is what stops someone
 * building a card with a giant X across the middle of it, and it is also why
 * they cannot be block types.
 *
 * The geocode flag is here for the same reason. It says how confident we are
 * about a pin's position, which is a fact about our own import pipeline — a
 * visitor has no use for it and never sees it.
 */
export function PlaceCardChrome({
  place,
  isEditing,
  onToggleEdit,
  onClose,
  onEdit,
}: {
  place: Place;
  /** Whether this card's blocks are currently offering their own menus. */
  isEditing?: boolean;
  /** Absent on a card that may not be redesigned -- the import review's. */
  onToggleEdit?: () => void;
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
       * photo that reaches the edges — a button in the flow would push it down
       * and put a white band above someone's picture. The backdrop is what keeps
       * both of these legible on whatever they land on.
       *
       * **Edit is here rather than in a footer**, which is where it used to be:
       * a full-width strip across the bottom of the card, spending a whole row
       * of a 320px card on a control only its owner ever sees, and pushing the
       * design they arranged up by its own height. Two icons in the corner cost
       * the card nothing, and the pair reads as one set of controls rather than
       * as one control and one afterthought.
       *
       * Edit first, so the X stays in the corner it has always been in — that is
       * where a hand goes to dismiss something without looking.
       *
       * HeroUI `Button`s wearing those two jobs rather than `IconButton`: these
       * have to be translucent over an arbitrary photo and sit at a size no
       * toolbar button is, and `IconButton` exists to make every *toolbar*
       * button identical.
       *
       * **And no tooltip on either**, which is the one thing they borrowed from
       * it and gave back. An `IconButton`'s tooltip earns its place on a toolbar
       * full of glyphs nobody has a prior for; a cross and a pencil in the
       * corner of a card are the two most over-learned icons on the web, and a
       * bubble saying "Close" over a card the pointer is already resting on
       * covers the card to explain the card. The label stays in `aria-label`, so
       * nothing is lost to a screen reader.
       */}
      {/*
       * Edit mode, in the opposite corner from the pair that dismiss and open
       * the dialog.
       *
       * Its own cluster rather than a third icon beside them, and the split is
       * the point: those two are about the *location* -- close it, open its
       * form -- and this one is about the *card*, which is a different subject
       * and stays pressed while you work in it. Three glyphs in one corner would
       * read as one set of controls, and the one that latches would be the odd
       * one out of it.
       *
       * `aria-pressed`, because that is what a latching control is; `data-open`
       * for the styling, on `.card-slot`'s own argument about HeroUI leaving a
       * stale attribute behind on a `Pressable` wrapper.
       */}
      {onToggleEdit ? (
        <div className="absolute top-1.5 left-1.5 z-10">
          <Button
            aria-label={isEditing ? "Done editing this card" : "Edit this card"}
            aria-pressed={isEditing}
            data-open={isEditing || undefined}
            isIconOnly
            size="sm"
            variant="tertiary"
            onPress={onToggleEdit}
            className="size-7 min-w-0 rounded-lg bg-surface/80 text-muted backdrop-blur-sm hover:bg-default hover:text-foreground data-[open]:bg-accent data-[open]:text-accent-foreground"
          >
            <SlidersHorizontal aria-hidden="true" className="size-4" />
          </Button>
        </div>
      ) : null}

      <div className="absolute top-1.5 right-1.5 z-10 flex items-center gap-1">
        {onEdit ? (
          <Button
            aria-label="Edit location"
            isIconOnly
            size="sm"
            variant="tertiary"
            onPress={() => onEdit(place.id)}
            className="size-7 min-w-0 rounded-lg bg-surface/80 text-muted backdrop-blur-sm hover:bg-default hover:text-foreground"
          >
            <Pencil aria-hidden="true" className="size-4" />
          </Button>
        ) : null}

        <Button
          aria-label="Close"
          isIconOnly
          size="sm"
          variant="tertiary"
          onPress={onClose}
          className="size-7 min-w-0 rounded-lg bg-surface/80 text-muted backdrop-blur-sm hover:bg-default hover:text-foreground"
        >
          <X aria-hidden="true" className="size-4" />
        </Button>
      </div>

      {/* All that is left of the footer, and it earns its row: an amber chip
          saying this pin's position is a guess is not a control, and there is
          nowhere in the corner to say a sentence. The chip, not the ring — the
          ring is the compromise a 320px sidebar forces, and a card footer has
          room for the word. */}
      {flagged ? (
        <div className="shrink-0 border-t border-border p-2">
          <PlaceStatusFlag status={place.geocodeStatus} variant="chip" />
        </div>
      ) : null}
    </>
  );
}
