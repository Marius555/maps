"use client";

import { Button, Modal } from "@heroui/react";

import { ErrorMessage } from "@/components/ui/error-message";
import { useDeleteMap } from "@/lib/query/maps";

/**
 * The confirmation, without a trigger of its own.
 *
 * Opened by the Delete item in a map card's menu. A menu item cannot own a
 * modal — the menu closes, and unmounts what it holds, the moment an item is
 * chosen — so the dialog is controlled from outside by the menu's parent.
 */
export function DeleteMapDialog({
  mapId,
  mapName,
  isOpen,
  onOpenChange,
  onDeleted,
}: {
  mapId: string;
  mapName: string;
  isOpen: boolean;
  onOpenChange: (isOpen: boolean) => void;
  /** Needed where the dialog sits on a page that the deletion destroys. */
  onDeleted?: () => void;
}) {
  const deleteMap = useDeleteMap();

  return (
    <Modal.Backdrop isOpen={isOpen} onOpenChange={onOpenChange}>
      <Modal.Container>
        <Modal.Dialog className="sm:max-w-[400px]">
          <Modal.CloseTrigger />
          <Modal.Header>
            <Modal.Heading>Delete {mapName}?</Modal.Heading>
          </Modal.Header>
          <Modal.Body className="space-y-3">
            <p className="text-sm text-muted">
              Every location on this map is deleted too. This can&apos;t be undone.
            </p>
            {deleteMap.error ? <ErrorMessage error={deleteMap.error} /> : null}
          </Modal.Body>
          <Modal.Footer>
            <Button slot="close" variant="tertiary">
              Keep map
            </Button>
            <Button
              variant="danger"
              isPending={deleteMap.isPending}
              onPress={async () => {
                await deleteMap.mutateAsync(mapId);
                onOpenChange(false);
                onDeleted?.();
              }}
            >
              Delete map
            </Button>
          </Modal.Footer>
        </Modal.Dialog>
      </Modal.Container>
    </Modal.Backdrop>
  );
}
