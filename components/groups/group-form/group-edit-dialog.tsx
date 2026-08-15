"use client";

import { Modal } from "@heroui/react";

import type { Group } from "@/lib/repositories/types";
import { GroupForm } from "./group-form";

/**
 * The group form in a modal.
 *
 * `group` doubles as the open state, for the reason `ShapeEditDialog` gives:
 * there is no such thing as this dialog open with nothing to edit, and two
 * sources of truth would let them disagree.
 */
export function GroupEditDialog({
  mapId,
  group,
  onClose,
}: {
  mapId: string;
  group: Group | null;
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
        <Modal.Dialog className="sm:max-w-[420px]">
          <Modal.CloseTrigger />
          <Modal.Header>
            <Modal.Heading>Edit group</Modal.Heading>
          </Modal.Header>
          <Modal.Body>
            {/* Keyed so switching groups resets the form rather than keeping the
                previous one's values. */}
            {group ? (
              <GroupForm
                key={group.id}
                mapId={mapId}
                group={group}
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
