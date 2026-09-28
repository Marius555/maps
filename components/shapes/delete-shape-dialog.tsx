"use client";

import { Button } from "@heroui/react";

import { ResponsiveDialog } from "@/components/ui/responsive-dialog/responsive-dialog";
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
    <ResponsiveDialog
      isOpen={shape !== null}
      onOpenChange={(isOpen) => {
        if (!isOpen) onClose();
      }}
      dialogClassName="sm:max-w-[400px]"
    >
      <ResponsiveDialog.Header>
        <ResponsiveDialog.Heading>Delete {shape?.name}?</ResponsiveDialog.Heading>
      </ResponsiveDialog.Header>
      <ResponsiveDialog.Body className="space-y-3">
        <p className="text-sm text-muted">
          This removes the shape from the map, and it can&apos;t be brought
          back. If the map is published, it stays visible to visitors until
          you publish again.
        </p>
        {error ? <ErrorMessage error={error} /> : null}
      </ResponsiveDialog.Body>
      <ResponsiveDialog.Footer>
        <Button slot="close" variant="tertiary">
          Keep it
        </Button>
        <Button variant="danger" isPending={isDeleting} onPress={onConfirm}>
          Delete shape
        </Button>
      </ResponsiveDialog.Footer>
    </ResponsiveDialog>
  );
}
