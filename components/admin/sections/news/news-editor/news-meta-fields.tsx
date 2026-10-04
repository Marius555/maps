"use client";

import { useEffect, useRef } from "react";
import { Controller, useWatch, type Control, type UseFormSetValue } from "react-hook-form";

import { FormDateTimeField } from "@/components/ui/form-date-time-field";
import { FormTextArea, FormTextField } from "@/components/ui/form-field";
import { SelectControl, type SelectOption } from "@/components/ui/select-control";
import { NEWS_CATEGORIES, NEWS_CATEGORY_LABELS } from "@/lib/news/types";
import { newsSlugFromTitle, type AdminNewsForm } from "@/lib/validation/news.schema";

const CATEGORY_OPTIONS: SelectOption[] = NEWS_CATEGORIES.map((id) => ({
  id,
  label: NEWS_CATEGORY_LABELS[id],
}));

const STATUS_OPTIONS: SelectOption[] = [
  { id: "draft", label: "Draft", description: "Only visible here." },
  { id: "published", label: "Published", description: "On the News page from its publish date." },
];

/**
 * Everything about a post but its body and cover.
 *
 * **The address follows the title until somebody edits it**, and only on a new
 * post: a published post's address is already in links and search results, so
 * renaming one must never quietly move it.
 */
export function NewsMetaFields({
  control,
  setValue,
  followTitle,
}: {
  control: Control<AdminNewsForm>;
  setValue: UseFormSetValue<AdminNewsForm>;
  /** True for a new post, until the slug field is edited by hand. */
  followTitle: boolean;
}) {
  const title = useWatch({ control, name: "title" });
  const status = useWatch({ control, name: "status" });
  const slugEdited = useRef(!followTitle);

  useEffect(() => {
    if (slugEdited.current) return;
    setValue("slug", newsSlugFromTitle(title), { shouldValidate: false, shouldDirty: true });
  }, [title, setValue]);

  return (
    <div className="space-y-4">
      <FormTextField control={control} name="title" label="Title" autoComplete="off" />

      <div onInput={() => (slugEdited.current = true)}>
        <FormTextField
          control={control}
          name="slug"
          label="Address"
          autoComplete="off"
          description="The end of the post's link: /news/your-address. Lowercase letters, numbers and hyphens."
        />
      </div>

      <FormTextArea control={control} name="summary" label="Summary" />

      <div className="grid gap-4 sm:grid-cols-2">
        <Controller
          control={control}
          name="category"
          render={({ field, fieldState }) => (
            <SelectControl
              label="Category"
              variant="secondary"
              options={CATEGORY_OPTIONS}
              value={field.value}
              error={fieldState.error?.message}
              onChange={field.onChange}
            />
          )}
        />
        <Controller
          control={control}
          name="status"
          render={({ field }) => (
            <SelectControl
              label="Status"
              variant="secondary"
              options={STATUS_OPTIONS}
              value={field.value}
              onChange={field.onChange}
            />
          )}
        />
      </div>

      {status === "published" ? (
        <FormDateTimeField
          control={control}
          name="publishedAt"
          label="Publish date"
          description="Your local time. Leave empty to publish now; a future date schedules the post."
        />
      ) : null}
    </div>
  );
}
