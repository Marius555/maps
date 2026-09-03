"use client";

import { Button, Input, TextField } from "@heroui/react";
import { useState } from "react";

import { ErrorMessage } from "@/components/ui/error-message";
import { SwatchPicker } from "@/components/ui/swatch-picker";
import { IMPORTED_TAG_GROUP_LABEL } from "@/lib/import/resolve-tags";
import { useUpdateMap } from "@/lib/query/maps";
import type { AppMap, MapTagGroup } from "@/lib/repositories/types";
import { nextPaletteColor } from "@/lib/validation/palette";
import {
  MAX_TAGS_TOTAL,
  newTagGroupId,
  newTagId,
  tagGroupsSchema,
} from "@/lib/validation/tag.schema";

/**
 * Minting a tag from inside the location dialog.
 *
 * The tags control used to render nothing at all until the map already had
 * tags, and the bulk menu still does — which meant the entire feature was
 * invisible from the one state every new map is in, and an owner could use the
 * editor for a week without learning tags existed. Creating one here is what
 * closes that: the moment you want a tag is the moment you are looking at a
 * location that needs it.
 *
 * Three rows, in this order, and the order is the ask: **name across the full
 * width**, then the colour, then the buttons. A name and a palette side by side
 * squeezed the field that carries the actual answer into half a dialog, and put
 * the eight swatches somewhere the eye reaches before the thing they belong to.
 *
 * **No group picker.** A new tag goes into the map's first group, or into a new
 * one called "Tags" when the map has none — the same label `resolveTags` gives
 * an imported column, so a hand-made tag and an imported one land in one place
 * rather than in two groups meaning the same thing. Asking which *question* a
 * tag answers, in the middle of filling in a location, is a concept lesson at
 * the wrong moment; regrouping is one drag in Settings → Filters, where the
 * groups are visible side by side.
 *
 * Renaming, recolouring, regrouping and removing all stay there for the same
 * reason: they act on every location wearing the tag, and this dialog is scoped
 * to one.
 *
 * Opening and closing belong to the caller (`TagPicker` opens it from the first
 * row of its own dropdown), because a create form that lives inside a menu has
 * to close when the menu does.
 */
export function TagQuickAdd({
  map,
  onCreated,
  onCancel,
}: {
  map: AppMap;
  /** Ticks the new tag in the form that owns the field. */
  onCreated: (tagId: string) => void;
  onCancel: () => void;
}) {
  const updateMap = useUpdateMap(map.id);

  /** The group a new tag joins. See the note above on why nothing asks. */
  const target = map.tagGroups[0];

  const [label, setLabel] = useState("");
  const [color, setColor] = useState<string>(
    // The next colour the map is not already wearing, so a new tag does not
    // arrive looking identical to one already in the legend. Across every group
    // rather than one: a pin shows a colour, not the question it answers.
    nextPaletteColor(
      map.tagGroups.flatMap((group) => group.tags.map((tag) => tag.color)),
    ),
  );
  const [problem, setProblem] = useState<string | null>(null);

  const total = map.tagGroups.reduce((sum, group) => sum + group.tags.length, 0);

  // Nothing to offer at the ceiling, and no control here could get past it — the
  // fix is removing a tag in Settings. `TagPicker` hides its "New tag" row for
  // the same reason, so in practice this is the belt to that braces.
  if (total >= MAX_TAGS_TOTAL) return null;

  const create = async () => {
    setProblem(null);

    // Random, never derived from the label. Nothing sweeps a deleted tag off the
    // places wearing it, so a reissued id would resurrect that tag onto
    // locations nobody assigned it to — see newTagId.
    const tag = { id: newTagId(), label: label.trim(), color };

    const next: MapTagGroup[] = target
      ? map.tagGroups.map((group) =>
          group.id === target.id
            ? { ...group, tags: [...group.tags, tag] }
            : group,
        )
      : [{ id: newTagGroupId(), label: IMPORTED_TAG_GROUP_LABEL, tags: [tag] }];

    /*
     * The whole vocabulary through the schema, not just the new tag.
     *
     * Every rule that matters here is a rule about the *set* — ids unique across
     * all groups, labels unique within one, and the three ceilings — so parsing
     * the array is what refuses a duplicate name in the dialog with the sentence
     * Settings would use, rather than as a 400 from the PATCH.
     */
    const parsed = tagGroupsSchema.safeParse(next);
    if (!parsed.success) {
      setProblem(
        parsed.error.issues[0]?.message ?? "Check the name and try again.",
      );
      return;
    }

    try {
      await updateMap.mutateAsync({ tagGroups: parsed.data });
      onCreated(tag.id);
    } catch {
      // Rendered from the mutation's own error below.
    }
  };

  return (
    <div className="space-y-3 rounded-lg border border-border bg-surface p-3">
      <TextField
        fullWidth
        autoFocus
        aria-label="New tag name"
        value={label}
        onChange={setLabel}
      >
        <Input placeholder="e.g. Sells bikes" />
      </TextField>

      <div className="space-y-1">
        <SwatchPicker
          label="Colour for the new tag"
          value={color}
          onChange={setColor}
        />

        {/* Said once, here, because it is the one thing about tag colour that is
            not obvious: a location can wear several, and only the first one it
            was given decides what its pin looks like. */}
        <p className="text-xs text-muted">
          A location’s first tag colours its pin.
        </p>
      </div>

      {problem ? <ErrorMessage error={problem} /> : null}
      {updateMap.error ? <ErrorMessage error={updateMap.error} /> : null}

      <div className="flex items-center gap-2">
        <Button
          size="sm"
          isDisabled={label.trim().length === 0}
          isPending={updateMap.isPending}
          onPress={create}
        >
          Add tag
        </Button>

        <Button size="sm" variant="tertiary" onPress={onCancel}>
          Cancel
        </Button>
      </div>
    </div>
  );
}
