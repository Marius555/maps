"use client";

import { Button } from "@heroui/react";
import { useState } from "react";

import { DeleteMapDialog } from "./delete-map-dialog";

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

      <DeleteMapDialog
        mapId={mapId}
        mapName={mapName}
        isOpen={isOpen}
        onOpenChange={setIsOpen}
        onDeleted={onDeleted}
      />
    </>
  );
}
