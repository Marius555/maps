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
        <Modal.Dialog className="sm:max-w-[520px]">
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
