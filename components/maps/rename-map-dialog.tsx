"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { Button } from "@heroui/react";
import { useForm } from "react-hook-form";
import { z } from "zod";

import { ResponsiveDialog } from "@/components/ui/responsive-dialog/responsive-dialog";
import { ErrorMessage } from "@/components/ui/error-message";
import { FormTextField } from "@/components/ui/form-field";
import { track } from "@/lib/posthog/client";
import { applyFieldErrors } from "@/lib/query/form-errors";
import { useUpdateMap } from "@/lib/query/maps";

const renameSchema = z.object({
  name: z
    .string()
    .trim()
    .min(1, "Give the map a name.")
    .max(128, "Keep the name under 128 characters."),
});

type RenameValues = z.infer<typeof renameSchema>;

/**
 * Renames a map, from its card's menu.
 *
 * Controlled from outside for the reason `DeleteMapDialog` is: a menu item
 * cannot own a modal, because the menu unmounts what it holds the moment an
 * item is chosen. The form is its own component so it mounts with the dialog
 * and takes the name as it is *now*, not as it was when the card rendered.
 */
export function RenameMapDialog({
  mapId,
  mapName,
  isOpen,
  onOpenChange,
}: {
  mapId: string;
  mapName: string;
  isOpen: boolean;
  onOpenChange: (isOpen: boolean) => void;
}) {
  return (
    <ResponsiveDialog
      isOpen={isOpen}
      onOpenChange={onOpenChange}
      dialogClassName="sm:max-w-[400px]"
    >
      <ResponsiveDialog.Header>
        <ResponsiveDialog.Heading>Rename map</ResponsiveDialog.Heading>
      </ResponsiveDialog.Header>
      <RenameForm mapId={mapId} mapName={mapName} onDone={() => onOpenChange(false)} />
    </ResponsiveDialog>
  );
}

function RenameForm({
  mapId,
  mapName,
  onDone,
}: {
  mapId: string;
  mapName: string;
  onDone: () => void;
}) {
  const updateMap = useUpdateMap(mapId);

  const {
    handleSubmit,
    control,
    setError,
    formState: { errors, isSubmitting, isDirty },
  } = useForm<RenameValues>({
    resolver: zodResolver(renameSchema),
    defaultValues: { name: mapName },
  });

  const onSubmit = handleSubmit(async (values) => {
    try {
      await updateMap.mutateAsync(values);
      track("map_renamed");
      onDone();
    } catch (error) {
      applyFieldErrors(error, setError);
    }
  });

  return (
    <form onSubmit={onSubmit} noValidate className="flex min-h-0 flex-1 flex-col">
      <ResponsiveDialog.Body className="space-y-3">
        {updateMap.error && !errors.name ? <ErrorMessage error={updateMap.error} /> : null}

        <FormTextField
          control={control}
          name="name"
          label="Map name"
          autoFocus
          description="Yours alone — visitors never see it."
        />
      </ResponsiveDialog.Body>
      <ResponsiveDialog.Footer>
        <Button slot="close" variant="tertiary">
          Cancel
        </Button>
        <Button type="submit" isPending={isSubmitting} isDisabled={!isDirty}>
          Save changes
        </Button>
      </ResponsiveDialog.Footer>
    </form>
  );
}
