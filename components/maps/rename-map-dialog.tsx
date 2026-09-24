"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { Button, Modal } from "@heroui/react";
import { useForm } from "react-hook-form";
import { z } from "zod";

import { ErrorMessage } from "@/components/ui/error-message";
import { FormTextField } from "@/components/ui/form-field";
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
    <Modal.Backdrop isOpen={isOpen} onOpenChange={onOpenChange}>
      <Modal.Container>
        <Modal.Dialog className="sm:max-w-[400px]">
          <Modal.CloseTrigger />
          <Modal.Header>
            <Modal.Heading>Rename map</Modal.Heading>
          </Modal.Header>
          <RenameForm mapId={mapId} mapName={mapName} onDone={() => onOpenChange(false)} />
        </Modal.Dialog>
      </Modal.Container>
    </Modal.Backdrop>
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
      onDone();
    } catch (error) {
      applyFieldErrors(error, setError);
    }
  });

  return (
    <form onSubmit={onSubmit} noValidate>
      <Modal.Body className="space-y-3">
        {updateMap.error && !errors.name ? <ErrorMessage error={updateMap.error} /> : null}

        <FormTextField
          control={control}
          name="name"
          label="Map name"
          autoFocus
          description="Yours alone — visitors never see it."
        />
      </Modal.Body>
      <Modal.Footer>
        <Button slot="close" variant="tertiary">
          Cancel
        </Button>
        <Button type="submit" isPending={isSubmitting} isDisabled={!isDirty}>
          Save changes
        </Button>
      </Modal.Footer>
    </form>
  );
}
