"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { Button, Description, Switch } from "@heroui/react";
import { Controller, useForm, type Control } from "react-hook-form";

import { ErrorMessage } from "@/components/ui/error-message";
import { SectionPanel } from "@/components/ui/section-panel";
import { applyFieldErrors } from "@/lib/query/form-errors";
import { useUpdateMap } from "@/lib/query/maps";
import type { AppMap } from "@/lib/repositories/types";
import {
  embedSettingsSchema,
  readEmbedSettings,
  type EmbedSettings,
} from "@/lib/validation/embed-settings.schema";

/**
 * Which controls the published map gives visitors.
 *
 * The original four were already wired end to end in the embed and read out of
 * the snapshot at publish time — but nothing ever wrote the column, so every map
 * shipped with all four switched on and no way to say otherwise. This is the
 * missing half.
 *
 * `list` is the one that changes the shape of the embed rather than adding a
 * control to it, which is why it leads. A map already published keeps the layout
 * it was published with: its live snapshot has no `list` key, and the embed
 * reads an absent one as off (packages/shared/snapshot.ts).
 *
 * It lives on the Publish tab rather than in Settings because these describe
 * what a stranger sees on someone else's website, which is what this whole tab
 * is about. Like everything else here, a change only reaches visitors on the
 * next Publish — the staleness badge above already says so, because `settings`
 * lives on the map row and bumps its `updatedAt`.
 */
const CONTROLS = [
  {
    name: "list",
    label: "Show the results list",
    description:
      "A scrollable panel of locations beside the map, with search and filters at the top of it. Clicking a row opens that location. Off, the map fills the whole space and the controls float over it.",
  },
  {
    name: "clustering",
    label: "Group nearby pins",
    description:
      "Locations close together collapse into one numbered circle until a visitor zooms in. Worth keeping on much above a hundred locations.",
  },
  {
    name: "search",
    label: "Let visitors search",
    description:
      "A box that narrows the list by name and address. It searches the locations already on the map and never calls out to anything.",
  },
  {
    name: "filters",
    label: "Show tag filters",
    description:
      "A row of chips per filter group. Picking two in one group widens the results; picking one in each narrows them. Tags nothing on the map wears are left out.",
  },
  {
    name: "nearest",
    label: "Offer find nearest",
    description:
      "A button that jumps to the closest location. The visitor's browser asks their permission first.",
  },
] as const satisfies readonly {
  name: keyof EmbedSettings;
  label: string;
  description: string;
}[];

export function EmbedSettingsForm({ map }: { map: AppMap }) {
  const updateMap = useUpdateMap(map.id);

  const {
    handleSubmit,
    control,
    setError,
    reset,
    formState: { isSubmitting, isDirty },
  } = useForm<EmbedSettings>({
    resolver: zodResolver(embedSettingsSchema),
    // Read through the same helper the snapshot generator uses, so the switches
    // show what would actually be published rather than a second opinion.
    defaultValues: readEmbedSettings(map.settings),
  });

  const onSubmit = handleSubmit(async (values) => {
    try {
      const saved = await updateMap.mutateAsync({ settings: values });
      reset(readEmbedSettings(saved.settings));
    } catch (error) {
      applyFieldErrors(error, setError);
    }
  });

  return (
    <form onSubmit={onSubmit} noValidate>
      <SectionPanel
        title="What visitors can do"
        description="Turn off anything your map doesn't need. Changes go live the next time you publish."
        footer={
          <Button type="submit" isPending={isSubmitting} isDisabled={!isDirty}>
            Save changes
          </Button>
        }
      >
        {updateMap.error ? <ErrorMessage error={updateMap.error} /> : null}

        <div className="space-y-4">
          {CONTROLS.map((item) => (
            <ControlSwitch key={item.name} control={control} {...item} />
          ))}
        </div>
      </SectionPanel>
    </form>
  );
}

/**
 * One switch, bound through `Controller`.
 *
 * `register()` is not an option: React Aria owns the input's value, so a
 * registered switch renders unchecked and then saves the wrong answer
 * (CLAUDE.md §0).
 */
function ControlSwitch({
  control,
  name,
  label,
  description,
}: {
  control: Control<EmbedSettings>;
  name: keyof EmbedSettings;
  label: string;
  description: string;
}) {
  return (
    <Controller
      control={control}
      name={name}
      render={({ field }) => (
        <Switch isSelected={field.value} onChange={field.onChange}>
          <Switch.Content>
            <Switch.Control>
              <Switch.Thumb />
            </Switch.Control>
            {label}
          </Switch.Content>
          <Description>{description}</Description>
        </Switch>
      )}
    />
  );
}
