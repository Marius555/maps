"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { Button } from "@heroui/react";
import { useForm } from "react-hook-form";
import { z } from "zod";

import { ErrorMessage } from "@/components/ui/error-message";
import { FormTextArea } from "@/components/ui/form-field";
import { applyFieldErrors } from "@/lib/query/form-errors";
import { useUpdateMap } from "@/lib/query/maps";
import type { AppMap } from "@/lib/repositories/types";
import { allowedDomainsSchema, MAX_ALLOWED_DOMAINS } from "@/lib/validation/domain.schema";

/**
 * One domain per line, in a plain textarea.
 *
 * A tag input would look tidier and be worse: people arrive here with a list
 * they want to paste. The server does the normalising, so a pasted
 * "https://www.example.com/shop" is stored as "www.example.com" without the
 * customer having to know that.
 */
const formSchema = z.object({
  domains: z
    .string()
    // Validate what the array schema would reject, before it becomes an array,
    // so the error lands on the field the user is looking at.
    .superRefine((value, ctx) => {
      const result = allowedDomainsSchema.safeParse(splitDomains(value));
      if (result.success) return;

      for (const issue of result.error.issues) {
        const line = typeof issue.path[0] === "number" ? issue.path[0] + 1 : null;
        ctx.addIssue({
          code: "custom",
          message: line ? `Line ${line}: ${issue.message}` : issue.message,
        });
      }
    }),
});

type FormValues = z.infer<typeof formSchema>;

export function AllowedDomainsForm({ map }: { map: AppMap }) {
  const updateMap = useUpdateMap(map.id);

  const {
    handleSubmit,
    control,
    setError,
    reset,
    formState: { errors, isSubmitting, isDirty },
  } = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: { domains: map.allowedDomains.join("\n") },
  });

  const onSubmit = handleSubmit(async (values) => {
    const domains = splitDomains(values.domains);

    try {
      const saved = await updateMap.mutateAsync({ allowedDomains: domains });
      // Re-seed from what the server stored, so the box shows the normalised
      // hostnames rather than whatever was pasted.
      reset({ domains: saved.allowedDomains.join("\n") });
    } catch (error) {
      applyFieldErrors(error, setError);
    }
  });

  /*
   * No `SectionPanel` around this any more — see EmbedSnippet's note. It is one
   * fold in the design sidebar, which already names it.
   *
   * Still a form with its own Save button rather than joining the designer's
   * write-on-change channel: a half-typed domain list is not a state to save,
   * and a debounced write would lock a map to `exampl` on the way to
   * `example.com`.
   */
  return (
    <form onSubmit={onSubmit} noValidate className="space-y-2">
      <p className="text-pretty text-xs text-muted">
        {`One per line, up to ${MAX_ALLOWED_DOMAINS}. Subdomains are included, so example.com also covers www.example.com. Leave it empty to allow the map anywhere.`}
      </p>

      {updateMap.error && !errors.domains ? (
        <ErrorMessage error={updateMap.error} />
      ) : null}

      <FormTextArea control={control} name="domains" label="Domains" />

      <p className="text-xs text-muted">
        This discourages someone copying your snippet onto their own site. It
        isn&rsquo;t a security control — the published map is a public file.
      </p>

      <Button
        type="submit"
        size="sm"
        isPending={isSubmitting}
        isDisabled={!isDirty}
      >
        Save changes
      </Button>
    </form>
  );
}

function splitDomains(value: string): string[] {
  // Commas as well as newlines: a list copied out of a spreadsheet arrives
  // comma-separated more often than not.
  return value
    .split(/[\n,]/)
    .map((line) => line.trim())
    .filter(Boolean);
}
