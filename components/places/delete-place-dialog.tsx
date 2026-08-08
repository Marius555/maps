"use client";

import { Button, Modal } from "@heroui/react";

import { ErrorMessage } from "@/components/ui/error-message";
import type { Place } from "@/lib/repositories/types";

/**
 * Confirms deleting a location.
 *
 * Deletion used to happen on the first click with no confirmation. That was
 * already risky; with the action reduced to an unlabelled icon it would be a
 * mis-click away from losing a location, so it now asks — the same treatment
 * deleting a map gets.
 *
 * One dialog for the whole list, driven by which place is pending. A dialog per
 * row would mean a modal per location on a 3,000-row map.
 */
export function DeletePlaceDialog({
  place,
  isDeleting,
  error,
  onConfirm,
  onClose,
}: {
  /** Doubles as the open state — there is no "open with nothing to delete". */
  place: Place | null;
  isDeleting: boolean;
  error: unknown;
  onConfirm: () => void;
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
        <Modal.Dialog className="sm:max-w-[400px]">
          <Modal.CloseTrigger />
          <Modal.Header>
            <Modal.Heading>Delete {place?.name}?</Modal.Heading>
          </Modal.Header>
          <Modal.Body className="space-y-3">
            <p className="text-sm text-muted">
              This removes the location from the map. If the map is published,
              it stays visible to visitors until you publish again.
            </p>
            {error ? <ErrorMessage error={error} /> : null}
          </Modal.Body>
          <Modal.Footer>
            <Button slot="close" variant="tertiary">
              Keep it
            </Button>
            <Button variant="danger" isPending={isDeleting} onPress={onConfirm}>
              Delete location
            </Button>
          </Modal.Footer>
        </Modal.Dialog>
      </Modal.Container>
    </Modal.Backdrop>
  );
}
