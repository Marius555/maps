"use client";

import { Button } from "@heroui/react";
import type { ReactNode } from "react";

import type { CustomPinIcon } from "@/packages/shared/pin-icons";

/**
 * The two ways out of the builder, and anything that went wrong on the way.
 *
 * Lives in the dialog's footer, which pins it: the option rows scroll above it,
 * so "Use pin" is reachable from wherever you are in the form rather than at the
 * end of a scroll. PinStudio owns that arrangement.
 *
 * `.modal__footer` and `.drawer__footer` are both `flex-row justify-end`
 * unlayered, so a `flex-col` utility on the slot itself would lose. Hence one
 * full-width child holding the error line and the button row.
 *
 * Uploading an image is not here any more: it is the Image tab of the pin's head
 * (PinImagePanel), because it changes what the pin *is* rather than finishing
 * the form. Deleting is not here either — it is in the title bar, beside the
 * thing it deletes, and well away from Save.
 */
export function PinActions({
  draft,
  isSaving,
  problem,
  onSave,
  onCancel,
}: {
  draft: CustomPinIcon;
  isSaving: boolean;
  /** Whatever the studio itself has to report — a refused pin, a failed save. */
  problem?: ReactNode;
  onSave: () => void;
  onCancel: () => void;
}) {
  return (
    <div className="flex w-full flex-col gap-2">
      {problem}

      <div className="flex items-center justify-end gap-2">
        <Button variant="tertiary" onPress={onCancel}>
          Cancel
        </Button>
        <Button isPending={isSaving} isDisabled={!draft.label.trim()} onPress={onSave}>
          Use pin
        </Button>
      </div>
    </div>
  );
}
