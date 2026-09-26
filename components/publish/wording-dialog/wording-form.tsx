"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { Button } from "@heroui/react";
import { useForm } from "react-hook-form";

import { FormTextField } from "@/components/ui/form-field";
import { wordingOverrides, wordingValues } from "@/lib/embed/languages";
import { WORDING_SECTIONS } from "@/lib/embed/wording-sections";
import {
  embedWordingFormSchema,
  type EmbedWordingForm,
} from "@/lib/validation/embed-settings.schema";
import type { EmbedStrings } from "@/packages/shared/embed-strings";

/**
 * Every phrase, filled in with what a visitor reads today.
 *
 * Prefilled rather than blank-with-a-placeholder: the owner is proofreading their
 * map, so the honest rendering is the words themselves. Saving keeps only what
 * differs from the chosen language (`wordingOverrides`), and a field cleared to
 * nothing goes back to the language's own word.
 */
export function WordingForm({
  language,
  strings,
  onSave,
  onCancel,
}: {
  language: string;
  strings: EmbedStrings;
  onSave: (next: EmbedStrings) => void;
  onCancel: () => void;
}) {
  const { control, handleSubmit, reset } = useForm<EmbedWordingForm>({
    resolver: zodResolver(embedWordingFormSchema),
    defaultValues: wordingValues(language, strings),
  });

  const save = handleSubmit((values) => onSave(wordingOverrides(language, values)));

  return (
    <form onSubmit={save} className="space-y-6">
      {WORDING_SECTIONS.map((section) => (
        <fieldset key={section.title} className="space-y-3">
          <legend className="pb-1 text-sm font-semibold text-foreground">
            {section.title}
          </legend>

          {section.fields.map((field) => (
            <FormTextField
              key={field.key}
              control={control}
              name={field.key}
              label={field.label}
              description={field.description}
            />
          ))}
        </fieldset>
      ))}

      {/* Wraps below 390px rather than squeezing three buttons into one row. */}
      <div className="flex flex-wrap items-center justify-between gap-2 pt-2">
        <Button
          variant="tertiary"
          size="sm"
          onPress={() => reset(wordingValues(language, {}))}
        >
          Use the language&rsquo;s wording
        </Button>

        <div className="flex gap-2">
          <Button variant="secondary" size="sm" onPress={onCancel}>
            Cancel
          </Button>
          <Button type="submit" size="sm">
            Save changes
          </Button>
        </div>
      </div>
    </form>
  );
}
