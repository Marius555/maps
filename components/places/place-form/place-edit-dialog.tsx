"use client";

import { Modal } from "@heroui/react";

import type { AppMap, Place } from "@/lib/repositories/types";
import { PlaceForm } from "./place-form";

/**
 * The edit form in a modal.
 *
 * `place` doubles as the open state: there is no such thing as this dialog open
 * with nothing to edit, and two sources of truth would let them disagree.
 */
export function PlaceEditDialog({
  map,
  place,
  onClose,
}: {
  map: AppMap;
  place: Place | null;
  onClose: () => void;
}) {
  return (
    <Modal.Backdrop
      isOpen={place !== null}
      onOpenChange={(isOpen) => {
        if (!isOpen) onClose();
      }}
    >
      {/* `scroll="inside"` written out rather than left to the default, because
          the whole arrangement below depends on it: it caps the dialog at the
          viewport and gives the overflow to the body alone, which is what keeps
          the footer against the bottom edge while a fold animates shut. Same
          call, and the same reason, as the pin studio's. */}
      <Modal.Container scroll="inside">
        {/* Wider than a form dialog normally wants, because this one holds a map
            and two-column field rows. At 520px the essentials stacked into a
            single column and the map was a letterbox. */}
        <Modal.Dialog className="sm:max-w-1xl ">
          <Modal.CloseTrigger />
          <Modal.Header>
            <Modal.Heading>Edit location</Modal.Heading>
          </Modal.Header>
          {/* The form draws its own `Modal.Body` and `Modal.Footer`: the buttons
              have to be siblings of the scroller rather than the last thing
              inside it, and the `<form>` has to span both so submit still
              reaches them. See the docblock in place-form.tsx.

              Keyed so switching locations resets the form rather than keeping
              the previous one's values. */}
          {place ? (
            <PlaceForm
              key={place.id}
              map={map}
              place={place}
              onSaved={onClose}
              onCancel={onClose}
            />
          ) : null}
        </Modal.Dialog>
      </Modal.Container>
    </Modal.Backdrop>
  );
}
