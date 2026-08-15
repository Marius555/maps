"use client";

import { Button, Modal } from "@heroui/react";

import type { Group } from "@/lib/repositories/types";

/**
 * Confirms taking a group apart.
 *
 * This used to be a delete dialog, and the copy was carrying the whole weight:
 * the control was a bin labelled "Delete", so the body had to open by talking
 * the user down from the idea that forty locations were about to go with it.
 * That was the wrong place to fix it — by the time anyone read the reassurance
 * they had already decided not to press the button.
 *
 * The control says "Ungroup" now, so this only has to confirm, not reassure. The
 * body still says where the members go, because that is the one thing genuinely
 * worth knowing, and the buttons are ordinary rather than danger-red: nothing
 * here is destroyed and a red button would be lying about the stakes.
 *
 * One dialog for the whole list, driven by which group is pending.
 *
 * No pending state and no inline error, unlike the delete dialogs beside it.
 * Confirming closes this immediately and lets the optimistic removal play out in
 * the panel — see the `onConfirm` in locations-list.tsx — so there is no window
 * in which a spinner or an alert could be read here. A failure is a toast.
 */
export function UngroupDialog({
  group,
  onConfirm,
  onClose,
}: {
  /** Doubles as the open state — there is no "open with nothing to ungroup". */
  group: Group | null;
  onConfirm: () => void;
  onClose: () => void;
}) {
  return (
    <Modal.Backdrop
      isOpen={group !== null}
      onOpenChange={(isOpen) => {
        if (!isOpen) onClose();
      }}
    >
      <Modal.Container>
        <Modal.Dialog className="sm:max-w-[400px]">
          <Modal.CloseTrigger />
          <Modal.Header>
            <Modal.Heading>Ungroup {group?.name}?</Modal.Heading>
          </Modal.Header>
          <Modal.Body>
            <p className="text-sm text-muted">
              The locations and shapes in it move back to the main list. Only the
              grouping goes, and nothing on the published map changes.
            </p>
          </Modal.Body>
          <Modal.Footer>
            <Button slot="close" variant="tertiary">
              Cancel
            </Button>
            {/* The name holds from the row's button through to here (§8). */}
            <Button onPress={onConfirm}>Ungroup</Button>
          </Modal.Footer>
        </Modal.Dialog>
      </Modal.Container>
    </Modal.Backdrop>
  );
}
