"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { z } from "zod";

import { FormTextArea, FormTextField } from "@/components/ui/form-field";
import { applyFieldErrors } from "@/lib/query/form-errors";
import { useUpdatePlace } from "@/lib/query/places";
import type { Place } from "@/lib/repositories/types";
import { placeFormSchema } from "@/lib/validation/place.schema";
import { SlotShell } from "./slot-shell";

/**
 * The slots that are one or more boxes of text: a name, a description, a
 * website, and the Links row's phone / email / website together.
 *
 * One component taking a list of fields rather than four near-identical ones,
 * because the only thing that differs between them is which keys of the place
 * they write — and `updatePlaceSchema` is `.partial()`, so every one of these is
 * a legal single-field PATCH against the route the edit dialog already uses. No
 * new endpoint, no repository change.
 *
 * **The schema is `placeFormSchema`'s own, narrowed.** Reusing it rather than
 * restating four rules is what keeps a phone number the slot accepts a phone
 * number the dialog accepts (§9: one schema per feature, used by the form and
 * the server alike). `.partial()` on top, because a slot shows one or three of
 * these fields and never all five.
 */
const slotTextSchema = placeFormSchema
  .pick({ name: true, phone: true, email: true, url: true, description: true })
  .partial();

type SlotTextValues = z.infer<typeof slotTextSchema>;

/** Which of the place's own text fields this slot is asking for. */
export type SlotTextInput = {
  name: keyof SlotTextValues;
  label: string;
  type?: "text" | "tel" | "email" | "url";
  /** A paragraph rather than a line — the description, and only it. */
  multiline?: boolean;
};

export function SlotTextForm({
  mapId,
  place,
  title,
  inputs,
  onDone,
}: {
  mapId: string;
  place: Place;
  title: string;
  inputs: SlotTextInput[];
  onDone: () => void;
}) {
  const updatePlace = useUpdatePlace(mapId);

  const {
    handleSubmit,
    control,
    setError,
    formState: { isDirty, isSubmitting },
  } = useForm<SlotTextValues>({
    resolver: zodResolver(slotTextSchema),
    // Only the keys this slot shows. A field the form does not render must not
    // arrive in the PATCH: `updatePlace` is optimistic and patches every key it
    // is handed, so an unlisted `""` would blank a value nobody touched.
    defaultValues: Object.fromEntries(
      inputs.map((input) => [input.name, valueOf(place, input.name)]),
    ),
  });

  const onSubmit = handleSubmit(async (values) => {
    try {
      await updatePlace.mutateAsync({
        placeId: place.id,
        input: Object.fromEntries(
          inputs.map((input) => [input.name, values[input.name] ?? ""]),
        ),
      });

      onDone();
    } catch (error) {
      applyFieldErrors(error, setError);
    }
  });

  return (
    <SlotShell
      title={title}
      error={updatePlace.error}
      isPending={isSubmitting}
      isDisabled={!isDirty}
      onSubmit={() => void onSubmit()}
      onCancel={onDone}
    >
      {inputs.map((input, index) =>
        input.multiline ? (
          <FormTextArea
            key={input.name}
            control={control}
            name={input.name}
            label={input.label}
          />
        ) : (
          <FormTextField
            key={input.name}
            control={control}
            name={input.name}
            label={input.label}
            type={input.type}
            // The slot is opened by a press and holds nothing, so the caret
            // belongs in the first box — otherwise every use of it is a press
            // followed by a second press to start typing.
            autoFocus={index === 0}
          />
        ),
      )}
    </SlotShell>
  );
}

/** The place's current value for a field, as a form holds it. */
function valueOf(place: Place, name: keyof SlotTextValues): string {
  switch (name) {
    case "name":
      return place.name;
    case "phone":
      return place.phone ?? "";
    case "email":
      return place.email ?? "";
    case "url":
      return place.url ?? "";
    case "description":
      return place.description ?? "";
  }
}
