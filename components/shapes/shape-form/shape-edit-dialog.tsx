"use client";


import { ResponsiveDialog } from "@/components/ui/responsive-dialog/responsive-dialog";
import type { Shape } from "@/lib/repositories/types";
import { ShapeForm } from "./shape-form";

/**
 * The shape form in a modal.
 *
 * `shape` doubles as the open state, for the reason `PlaceEditDialog` gives: there
 * is no such thing as this dialog open with nothing to edit, and two sources of
 * truth would let them disagree.
 */
export function ShapeEditDialog({
  mapId,
  shape,
  onClose,
}: {
  mapId: string;
  shape: Shape | null;
  onClose: () => void;
}) {
  return (
    <ResponsiveDialog
      isOpen={shape !== null}
      onOpenChange={(isOpen) => {
        if (!isOpen) onClose();
      }}
      dialogClassName="sm:max-w-[480px]"
    >
      <ResponsiveDialog.Header>
        <ResponsiveDialog.Heading>Edit shape</ResponsiveDialog.Heading>
      </ResponsiveDialog.Header>
      <ResponsiveDialog.Body>
        {/* Keyed so switching shapes resets the form rather than keeping the
            previous one's values. */}
        {shape ? (
          <ShapeForm
            key={shape.id}
            mapId={mapId}
            shape={shape}
            onSaved={onClose}
            onCancel={onClose}
          />
        ) : null}
      </ResponsiveDialog.Body>
    </ResponsiveDialog>
  );
}
