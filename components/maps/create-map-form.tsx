"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { Button } from "@heroui/react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";

import { ErrorMessage } from "@/components/ui/error-message";
import { FormTextField } from "@/components/ui/form-field";
import { DEFAULT_CENTER } from "@/lib/config";
import { DEFAULT_MAP_STYLE } from "@/lib/map/style";
import { useCreateMap } from "@/lib/query/maps";
import { applyFieldErrors } from "@/lib/query/form-errors";
import {
  createMapSchema,
  type CreateMapFormValues,
  type CreateMapInput,
} from "@/lib/validation/map.schema";

/**
 * Kept separate from the dialog so the same form can be dropped anywhere —
 * an onboarding step, an empty state — without dragging a modal along with it.
 */
export function CreateMapForm({ onCreated }: { onCreated?: () => void }) {
  const router = useRouter();
  const createMap = useCreateMap();

  const {
    control,
    handleSubmit,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<CreateMapFormValues, unknown, CreateMapInput>({
    resolver: zodResolver(createMapSchema),
    defaultValues: {
      name: "",
      style: DEFAULT_MAP_STYLE,
      defaultLat: DEFAULT_CENTER.lat,
      defaultLng: DEFAULT_CENTER.lng,
      defaultZoom: DEFAULT_CENTER.zoom,
    },
  });

  const onSubmit = handleSubmit(async (values) => {
    try {
      const map = await createMap.mutateAsync(values);
      onCreated?.();
      router.push(`/maps/${map.id}`);
    } catch (error) {
      applyFieldErrors(error, setError);
    }
  });

  return (
    <form onSubmit={onSubmit} className="space-y-4" noValidate>
      {createMap.error && !errors.name ? (
        <ErrorMessage error={createMap.error} />
      ) : null}

      <FormTextField
        control={control}
        name="name"
        label="Map name"
        placeholder="Stockists"
        autoFocus
      />

      <Button type="submit" fullWidth isPending={isSubmitting}>
        Create map
      </Button>
    </form>
  );
}
