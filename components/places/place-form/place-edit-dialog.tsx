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
      <Modal.Container>
        {/* Wider than a form dialog normally wants, because this one holds a map
            and two-column field rows. At 520px the essentials stacked into a
            single column and the map was a letterbox. */}
        <Modal.Dialog className="sm:max-w-1xl ">
          <Modal.CloseTrigger />
          <Modal.Header>
            <Modal.Heading>Edit location</Modal.Heading>
          </Modal.Header>
          <Modal.Body>
            {/* Keyed so switching locations resets the form rather than keeping
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
          </Modal.Body>
        </Modal.Dialog>
      </Modal.Container>
    </Modal.Backdrop>
  );
}
