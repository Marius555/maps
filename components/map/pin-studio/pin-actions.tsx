"use client";

import { Button } from "@heroui/react";
import { useState, type ReactNode } from "react";

import { ErrorMessage } from "@/components/ui/error-message";
import { PIN_ICONS, type CustomPinIcon } from "@/packages/shared/pin-icons";
import { PinImageField } from "./pin-image-field";

/**
 * The three ways out of the builder, and anything that went wrong on the way.
 *
 * Lives in the dialog's footer, which pins it: the option rows scroll between the
 * hero and this, so "Use pin" is reachable from wherever you are in the form
 * rather than at the end of a scroll. PinStudio owns that arrangement.
 *
 * `.modal__footer` and `.drawer__footer` are both `flex-row justify-end`
 * unlayered, so a `flex-col` utility on the slot itself would lose. Hence one
 * full-width child holding the two stacked halves — the same trick the title row
 * uses against `.modal__header`'s `flex-col`.
 *
 * Upload leads, because it is the other answer to "what goes in this pin" rather
 * than a way to finish; `ms-auto` on the group keeps the two that do finish it
 * together at the right.
 *
 * Errors are here and not at the top of the body for the same reason the buttons
 * are: a save that failed while the form was scrolled to its last row would
 * otherwise report itself somewhere nobody is looking. Every failure this dialog
 * can produce — a pin the schema refuses, a PATCH that didn't land, an image that
 * wouldn't read — comes from a control in this row.
 *
 * Deleting is not here. It is in the dialog's own title bar, beside the close
 * button, which is where an action on the *thing being edited* belongs — the
 * footer is for finishing the form, and a destructive button sharing a row with
 * Save is a mis-click waiting to happen.
 */
export function PinActions({
  draft,
  isSaving,
  problem,
  onChange,
  onSave,
  onCancel,
}: {
  draft: CustomPinIcon;
  isSaving: boolean;
  /** Whatever the studio itself has to report — a refused pin, a failed save. */
  problem?: ReactNode;
  onChange: (draft: CustomPinIcon) => void;
  onSave: () => void;
  onCancel: () => void;
}) {
  const [imageProblem, setImageProblem] = useState<string | null>(null);

  /**
   * Clearing the image has to hand the head back to something — `pinIconSchema`
   * refuses a pin that is neither glyph nor image — and the first built-in is a
   * better answer than an empty pin. Owned here because both the upload button
   * and its way back call it.
   */
  const setImage = (image: string) =>
    onChange({
      ...draft,
      image,
      glyph: image ? "" : draft.glyph || PIN_ICONS[0].id,
    });

  return (
    <div className="flex w-full flex-col gap-2">
      {problem}
      {imageProblem ? <ErrorMessage error={imageProblem} /> : null}

      <div className="flex flex-wrap items-center gap-2">
        <PinImageField
          hasImage={Boolean(draft.image)}
          onChange={setImage}
          onProblem={setImageProblem}
        />

        {draft.image ? (
          <Button variant="tertiary" onPress={() => setImage("")}>
            Use an icon instead
          </Button>
        ) : null}

        <div className="ms-auto flex items-center gap-2">
          <Button variant="tertiary" onPress={onCancel}>
            Cancel
          </Button>
          <Button isPending={isSaving} isDisabled={!draft.label.trim()} onPress={onSave}>
            Use pin
          </Button>
        </div>
      </div>
    </div>
  );
}
