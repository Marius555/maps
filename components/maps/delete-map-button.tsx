"use client";

import { Button, Modal } from "@heroui/react";
import { useState } from "react";

import { ErrorMessage } from "@/components/ui/error-message";
import { useDeleteMap } from "@/lib/query/maps";

export function DeleteMapButton({
  mapId,
  mapName,
  onDeleted,
}: {
  mapId: string;
  mapName: string;
  /** Needed where the button sits on a page that the deletion destroys. */
  onDeleted?: () => void;
}) {
  const [isOpen, setIsOpen] = useState(false);
  const deleteMap = useDeleteMap();

  return (
    <>
      <Button
        size="sm"
        variant="tertiary"
        aria-label={`Delete ${mapName}`}
        onPress={() => setIsOpen(true)}
      >
        Delete
      </Button>

      <Modal.Backdrop isOpen={isOpen} onOpenChange={setIsOpen}>
        <Modal.Container>
          <Modal.Dialog className="sm:max-w-[400px]">
            <Modal.CloseTrigger />
            <Modal.Header>
              <Modal.Heading>Delete {mapName}?</Modal.Heading>
            </Modal.Header>
            <Modal.Body className="space-y-3">
              <p className="text-sm text-muted">
                Every location on this map is deleted too. This can&apos;t be
                undone.
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
                  setIsOpen(false);
                  onDeleted?.();
                }}
              >
                Delete map
              </Button>
            </Modal.Footer>
          </Modal.Dialog>
        </Modal.Container>
      </Modal.Backdrop>
    </>
  );
}
