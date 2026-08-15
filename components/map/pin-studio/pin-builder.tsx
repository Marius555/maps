"use client";

import { Button, Input, Label, TextField } from "@heroui/react";
import { useState } from "react";

import { ErrorMessage } from "@/components/ui/error-message";
import { PIN_ICONS, type CustomPinIcon } from "@/packages/shared/pin-icons";
import { PinColorField } from "./pin-color-field";
import { PinIconField } from "./pin-icon-field";
import { PinImageField } from "./pin-image-field";

/**
 * Build one pin: a shape, a colour and a name.
 *
 * No separate preview panel. The icon carousel draws every option as a real pin
 * in the draft's own colour, using the same `pinSvg` the map uses — so the
 * control *is* the preview, and a second drawing of the same pin higher up the
 * dialog would only be another thing to keep in sync.
 *
 * Shape first, then colour, then name: the two decisions with a visible result
 * are the ones worth opening with, and a name is the easiest thing to supply
 * once you can see what you are naming.
 *
 * Colour reuses the category palette rather than offering a wheel, for the same
 * reason categories don't get one: eight distinguishable colours chosen once
 * beats eight shades of the same blue and an unreadable map.
 *
 * Uploading a logo is the *other* way to answer "what shape", so it sits in the
 * footer with the buttons that end the form rather than in the middle of it.
 * Delete is not down there with them — it is the trash in the Icon section, so
 * the footer is the same three slots whether the pin is new or existing.
 */
export function PinBuilder({
  draft,
  usageCount,
  isSaving,
  isExisting,
  onChange,
  onSave,
  onDelete,
  onCancel,
}: {
  draft: CustomPinIcon;
  /** Locations wearing this pin, so deleting it isn't a blind decision. */
  usageCount: number;
  isSaving: boolean;
  isExisting: boolean;
  onChange: (draft: CustomPinIcon) => void;
  onSave: () => void;
  onDelete: () => void;
  onCancel: () => void;
}) {
  const [imageProblem, setImageProblem] = useState<string | null>(null);

  /**
   * Clearing the image has to hand the head back to something — `pinIconSchema`
   * refuses a pin that is neither glyph nor image — and the first built-in is a
   * better answer than an empty pin. Owned here because both the footer's upload
   * button and the icon field's way back call it.
   */
  const setImage = (image: string) =>
    onChange({
      ...draft,
      image,
      glyph: image ? "" : draft.glyph || PIN_ICONS[0].id,
    });

  return (
    <div className="flex flex-col gap-5">
      <PinIconField
        draft={draft}
        usageCount={usageCount}
        isExisting={isExisting}
        onChange={onChange}
        onImageChange={setImage}
        onDelete={onDelete}
      />

      <PinColorField
        value={draft.color}
        onChange={(color) => onChange({ ...draft, color })}
      />

      <TextField
        fullWidth
        value={draft.label}
        onChange={(label) => onChange({ ...draft, label })}
      >
        <Label>Name</Label>
        <Input placeholder="Flagship store" />
      </TextField>

      {imageProblem ? <ErrorMessage error={imageProblem} /> : null}

      {/* Stacked on a phone, one row from `sm` up. The three labels measure wider
          than a 360px sheet, and a footer that fits by truncating "Upload an
          image" is worse than one that takes a second line. `sm` is the same
          breakpoint the studio swaps its drawer for a dialog. */}
      <div className="flex flex-col gap-2 border-t border-border pt-4 sm:flex-row sm:items-center">
        <PinImageField
          hasImage={Boolean(draft.image)}
          onChange={setImage}
          onProblem={setImageProblem}
        />

        <div className="flex items-center justify-end gap-2">
          <Button variant="tertiary" onPress={onCancel}>
            Cancel
          </Button>
          <Button isPending={isSaving} isDisabled={!draft.label.trim()} onPress={onSave}>
            {isExisting ? "Save pin" : "Create pin"}
          </Button>
        </div>
      </div>
    </div>
  );
}
