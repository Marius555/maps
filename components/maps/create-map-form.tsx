"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { Button } from "@heroui/react";
import { useRouter } from "next/navigation";
import { useQueryClient } from "@tanstack/react-query";
import { useEffect, useTransition } from "react";
import { useForm } from "react-hook-form";

import { ErrorMessage } from "@/components/ui/error-message";
import { FormTextField } from "@/components/ui/form-field";
import { DEFAULT_CENTER } from "@/lib/config";
// `auto` is the default, so a new map already follows whoever is looking at it —
// there is no theme to read here any more.
import { DEFAULT_MAP_STYLE } from "@/lib/map/style";
import { track } from "@/lib/posthog/client";
import { addMapToCachedList, useCreateMap } from "@/lib/query/maps";
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

  /*
   * The navigation runs in a transition so the button stays pending until the
   * editor route commits. Closing the dialog first — what this used to do —
   * showed the maps list for the whole server round trip and then jumped to the
   * editor; left open, the dialog unmounts with the list the moment the
   * editor's skeleton replaces it.
   */
  const [isNavigating, startNavigation] = useTransition();

  /*
   * The new map joins the cached maps list only when this form unmounts —
   * which is when the editor replaces the maps page. Added any earlier, the
   * list redrew underneath the pending dialog, and on a first map the empty
   * state holding the dialog gave way to the list: the dialog vanished and the
   * maps page flashed before the editor. See `useCreateMap`.
   */
  const queryClient = useQueryClient();
  const createdMap = createMap.data;
  useEffect(() => {
    if (!createdMap) return;
    return () => addMapToCachedList(queryClient, createdMap);
  }, [createdMap, queryClient]);

  const onSubmit = handleSubmit(async (values) => {
    try {
      const map = await createMap.mutateAsync(values);
      track("map_created", { default_style: values.style });
      startNavigation(() => {
        router.push(`/maps/${map.id}`);
      });
      onCreated?.();
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
        autoFocus
      />

      <Button type="submit" fullWidth isPending={isSubmitting || isNavigating}>
        Create map
      </Button>
    </form>
  );
}
