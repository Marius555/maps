"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { Button, Label } from "@heroui/react";
import { Controller, useForm } from "react-hook-form";

import { SwatchPicker } from "@/components/ui/swatch-picker";
import { ErrorMessage } from "@/components/ui/error-message";
import { FormTextField } from "@/components/ui/form-field";
import { applyFieldErrors } from "@/lib/query/form-errors";
import { useUpdateGroup } from "@/lib/query/groups";
import type { Group } from "@/lib/repositories/types";
import {
  groupFormSchema,
  type GroupFormValues,
} from "@/lib/validation/group.schema";

/**
 * Edits one group — which is to say, renames it.
 *
 * Two fields, and both are about telling this group from the others. Membership
 * is not here: it is changed by dragging rows or by drawing a box on the map,
 * which are the gestures that can see what they are acting on. A multi-select
 * list of 400 locations in a modal would be the worst possible way to say "these
 * six".
 *
 * Fields bind through FormTextField, never `register()`. React Aria owns an
 * input's value, so a registered field renders blank and then saves the blank —
 * see components/ui/form-field.tsx.
 */
export function GroupForm({
  mapId,
  group,
  onSaved,
  onCancel,
}: {
  mapId: string;
  group: Group;
  onSaved?: () => void;
  onCancel?: () => void;
}) {
  const updateGroup = useUpdateGroup(mapId);

  const {
    handleSubmit,
    control,
    setError,
    formState: { isSubmitting },
  } = useForm<GroupFormValues>({
    resolver: zodResolver(groupFormSchema),
    defaultValues: {
      name: group.name,
      color: group.color,
    },
  });

  const onSubmit = handleSubmit(async (values) => {
    try {
      await updateGroup.mutateAsync({ groupId: group.id, input: values });
      onSaved?.();
    } catch (error) {
      applyFieldErrors(error, setError);
    }
  });

  return (
    <form onSubmit={onSubmit} className="space-y-4" noValidate>
      {updateGroup.error ? <ErrorMessage error={updateGroup.error} /> : null}

      <FormTextField
        control={control}
        name="name"
        label="Name"
      />

      <Controller
        control={control}
        name="color"
        render={({ field }) => (
          <div className="space-y-2">
            <Label>Colour</Label>
            <SwatchPicker
              label="Group colour"
              value={field.value}
              onChange={field.onChange}
            />
          </div>
        )}
      />

      {/* Said plainly, because a colour picker in a map editor invites the
          opposite assumption — and because half of what this used to say stopped
          being true: the colour *does* paint the group's pins and shapes here,
          it just never leaves the editor. */}
      <p className="text-xs text-muted">
        The colour marks this group&apos;s locations and shapes while you work.
        Groups don&apos;t appear on the published map.
      </p>

      <div className="flex justify-end gap-2">
        {onCancel ? (
          <Button variant="tertiary" onPress={onCancel}>
            Cancel
          </Button>
        ) : null}
        <Button type="submit" isPending={isSubmitting}>
          Save changes
        </Button>
      </div>
    </form>
  );
}
