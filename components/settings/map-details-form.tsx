"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { Button } from "@heroui/react";
import { Controller, useForm } from "react-hook-form";
import { z } from "zod";

import { ErrorMessage } from "@/components/ui/error-message";
import { FormTextField } from "@/components/ui/form-field";
import { SectionPanel } from "@/components/ui/section-panel";
import { MAP_STYLES } from "@/lib/map/style";
import { applyFieldErrors } from "@/lib/query/form-errors";
import { useUpdateMap } from "@/lib/query/maps";
import type { AppMap } from "@/lib/repositories/types";
import { formatCoords } from "@/lib/map/geo";
import { BasemapPicker } from "./basemap-picker";

/**
 * Name and basemap. Both are the whole of "map details" — the default view is set
 * by panning the map and pressing Save this view, because nobody wants to type a
 * latitude.
 */
const detailsSchema = z.object({
  name: z
    .string()
    .trim()
    .min(1, "Give the map a name.")
    .max(128, "Keep the name under 128 characters."),
  style: z.enum(MAP_STYLES),
});

type DetailsValues = z.infer<typeof detailsSchema>;

export function MapDetailsForm({ map }: { map: AppMap }) {
  const updateMap = useUpdateMap(map.id);

  const {
    handleSubmit,
    control,
    setError,
    formState: { errors, isSubmitting, isDirty },
  } = useForm<DetailsValues>({
    resolver: zodResolver(detailsSchema),
    defaultValues: { name: map.name, style: map.style },
  });

  const onSubmit = handleSubmit(async (values) => {
    try {
      await updateMap.mutateAsync(values);
    } catch (error) {
      applyFieldErrors(error, setError);
    }
  });

  return (
    // The panel sits inside the form so its footer button can submit it.
    <form onSubmit={onSubmit} noValidate>
      <SectionPanel
        title="Map details"
        description="The name is yours alone — visitors never see it."
        footer={
          <Button type="submit" isPending={isSubmitting} isDisabled={!isDirty}>
            Save changes
          </Button>
        }
      >
        {updateMap.error && !errors.name ? (
          <ErrorMessage error={updateMap.error} />
        ) : null}

        <FormTextField
          control={control}
          name="name"
          label="Map name"
          placeholder="Stockists"
        />

        <Controller
          control={control}
          name="style"
          render={({ field }) => (
            <BasemapPicker
              value={field.value}
              error={errors.style?.message}
              onChange={field.onChange}
            />
          )}
        />

        <p className="text-xs text-muted">
          Opens at {formatCoords(map.defaultLat, map.defaultLng)}, zoom{" "}
          {map.defaultZoom}. Change it on the Map tab with{" "}
          <span className="text-foreground">Save this view</span>.
        </p>
      </SectionPanel>
    </form>
  );
}
