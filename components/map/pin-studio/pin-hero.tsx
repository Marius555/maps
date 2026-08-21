"use client";

import { Input, Label, TextField } from "@heroui/react";

import { PinPreview } from "@/components/map/pin-preview";
import type { CustomPinIcon } from "@/packages/shared/pin-icons";

/**
 * The pin you are making, and its name.
 *
 * It sits in the dialog's *header*, not at the top of its body, which is what
 * keeps it on screen while you scroll the seven rows under it. That is the whole
 * reason it exists: the option tiles each show the pin with one field swapped
 * (see PinDesignRow), and this is the one that shows the pin you actually have,
 * large enough that a ring thickness or a logo reads.
 *
 * Stacked, and centred over the form rather than beside it. A pin on the left with
 * a field filling the row read as an avatar next to a text input — a decoration
 * beside the real control. Above it, at 72px, it is plainly the subject and the
 * name is the first thing you say about it.
 *
 * The field is a third of the width because a pin name is two or three words and
 * a full-width input invites a sentence. The floor is for the phone sheet, where
 * a third of 360px is about eight characters.
 */
export function PinHero({
  draft,
  onChange,
}: {
  draft: CustomPinIcon;
  onChange: (draft: CustomPinIcon) => void;
}) {
  return (
    <div className="flex flex-col items-center gap-3">
      {/* The resolver takes a library and an id, so the draft is handed to it as a
          one-entry library — the same drawing path the markers take, rather than a
          second one that renders a draft. */}
      <PinPreview icon="custom:preview" pinIcons={[{ ...draft, id: "preview" }]} size="xl" />

      <TextField
        className="w-1/3 min-w-40"
        value={draft.label}
        onChange={(label) => onChange({ ...draft, label })}
      >
        <Label>Name</Label>
        <Input />
      </TextField>
    </div>
  );
}
