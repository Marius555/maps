"use client";

import { Button, Modal } from "@heroui/react";

import { ErrorMessage } from "@/components/ui/error-message";
import type { Shape } from "@/lib/repositories/types";

/**
 * Confirms deleting a shape.
 *
 * It asks for the same reason deleting a location does — the action is an
 * unlabelled icon — and with more force behind it here: a polygon is a dozen
 * clicks of work, and there is no undo.
 *
 * One dialog for the whole list, driven by which shape is pending.
 */
export function DeleteShapeDialog({
  shape,
  isDeleting,
  error,
  onConfirm,
  onClose,
}: {
  /** Doubles as the open state — there is no "open with nothing to delete". */
  shape: Shape | null;
  isDeleting: boolean;
  error: unknown;
  onConfirm: () => void;
  onClose: () => void;
}) {
  return (
    <Modal.Backdrop
      isOpen={shape !== null}
      onOpenChange={(isOpen) => {
        if (!isOpen) onClose();
      }}
    >
      <Modal.Container>
        <Modal.Dialog className="sm:max-w-[400px]">
          <Modal.CloseTrigger />
          <Modal.Header>
            <Modal.Heading>Delete {shape?.name}?</Modal.Heading>
          </Modal.Header>
          <Modal.Body className="space-y-3">
            <p className="text-sm text-muted">
              This removes the shape from the map, and it can&apos;t be brought
              back. If the map is published, it stays visible to visitors until
              you publish again.
            </p>
            {error ? <ErrorMessage error={error} /> : null}
          </Modal.Body>
          <Modal.Footer>
            <Button slot="close" variant="tertiary">
              Keep it
            </Button>
            <Button variant="danger" isPending={isDeleting} onPress={onConfirm}>
              Delete shape
            </Button>
          </Modal.Footer>
        </Modal.Dialog>
      </Modal.Container>
    </Modal.Backdrop>
  );
}
