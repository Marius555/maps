"use client";

import { useWatch, type Control } from "react-hook-form";

import { FormTextField } from "@/components/ui/form-field";
import type { PlaceFormValues } from "@/lib/validation/place.schema";
import { FormSection, filledSummary } from "./form-section";

/**
 * How a visitor gets in touch. All three optional, all three folded away.
 *
 * `useWatch`, never `watch()`: `watch()` returns a fresh function every render,
 * which the React Compiler can't memoize, so it opts the whole component out
 * (CLAUDE.md). Here it is what keeps the summary honest — "2 of 3" has to change
 * as the fields are typed into, not only after a save.
 */
export function ContactSection({
  control,
  hasError,
}: {
  control: Control<PlaceFormValues>;
  hasError?: boolean;
}) {
  const phone = useWatch({ control, name: "phone" });
  const email = useWatch({ control, name: "email" });
  const url = useWatch({ control, name: "url" });

  return (
    <FormSection
      title="Contact"
      summary={filledSummary([phone, email, url])}
      hasError={hasError}
    >
      {/* `@md:`, not `sm:`. The container is the dialog body (place-form.tsx),
          so the row splits when there is room for two columns rather than when
          the *window* is wide — which used to give a 448px dialog two columns on
          every desktop, and a phone in landscape one. */}
      <div className="grid gap-4 @md:grid-cols-2">
        <FormTextField control={control} name="phone" label="Phone" type="tel" />
        <FormTextField control={control} name="email" label="Email" type="email" />
      </div>

      <FormTextField
        control={control}
        name="url"
        label="Website"
        type="url"
      />
    </FormSection>
  );
}
