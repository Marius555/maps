"use client";

import { Button, Input, Label, TextField } from "@heroui/react";
import { Plus, Trash2, X } from "lucide-react";
import { useState } from "react";

import { SwatchButton } from "@/components/ui/swatch-button";
import type { MapTagGroup } from "@/lib/repositories/types";
import { nextPaletteColor } from "@/lib/validation/palette";
import { MAX_TAGS_PER_GROUP, newTagId } from "@/lib/validation/tag.schema";

/**
 * One filter group: a question, and the answers a location can give.
 *
 * The nesting is the point. The embed reads groups as AND and the tags inside
 * one as OR, so a visitor sees "Sells: bikes or skis" narrowed by "Open:
 * Sundays" — and the owner has to be able to see which tags share a question
 * while they are writing them.
 *
 * Since categories merged into tags this is the map's *only* vocabulary editor,
 * which is why every tag carries a colour here. That colour is not decoration: a
 * location's first tag is what colours its pin (lib/validation/tag.schema.ts), so
 * this row is where a map's legend is written.
 *
 * **One surface, no borders inside it.** Tags were bordered chips holding
 * bordered inputs inside a bordered group inside a panel — four edges around one
 * word, and a fixed-width input that did not fit its own chip. Now the group is
 * a grey block, the inputs are the only frames in it, and tags are a vertical
 * list: a name can be as long as it needs and the colour dot lines up down the
 * left edge, which is how the legend reads on the map.
 */
export function TagGroupRow({
  group,
  autoFocus,
  usageByTag,
  takenColors,
  onChange,
  onRemove,
}: {
  group: MapTagGroup;
  /** Focus the group name on mount — the group was just added. */
  autoFocus?: boolean;
  /** How many locations wear each tag, so removing one isn't a blind decision. */
  usageByTag: Map<string, number>;
  /** Every colour the map already uses, so a new tag arrives with a fresh one. */
  takenColors: string[];
  onChange: (group: MapTagGroup) => void;
  onRemove: () => void;
}) {
  const named = group.label || "this group";
  // The tag just added takes focus, so "Add tag" then typing names it.
  const [addedTagId, setAddedTagId] = useState<string | null>(null);

  const updateTag = (index: number, patch: Partial<MapTagGroup["tags"][number]>) =>
    onChange({
      ...group,
      tags: group.tags.map((existing, position) =>
        position === index ? { ...existing, ...patch } : existing,
      ),
    });

  const addTag = () => {
    const id = newTagId();
    setAddedTagId(id);
    onChange({
      ...group,
      // Fresh id, never a reused one — see newTagId. Nothing sweeps a deleted tag
      // off the places wearing it, so a repeated id would resurrect it onto
      // locations nobody assigned it to.
      //
      // The colour avoids what the *whole map* already wears, not just this
      // group: a pin shows one colour and a visitor reads one legend, so two
      // tags matching across two groups is the collision that costs something.
      tags: [
        ...group.tags,
        { id, label: "", color: nextPaletteColor(takenColors) },
      ],
    });
  };

  return (
    <li className="space-y-3 rounded-xl bg-surface-secondary p-3 sm:p-4">
      <div className="flex items-end gap-2">
        <TextField
          fullWidth
          autoFocus={autoFocus}
          value={group.label}
          onChange={(label) => onChange({ ...group, label })}
          className="min-w-0 flex-1"
        >
          <Label>Group name</Label>
          <Input placeholder="What visitors filter by, e.g. Sells" />
        </TextField>

        <Button
          size="sm"
          variant="ghost"
          isIconOnly
          aria-label={`Remove ${named}`}
          onPress={onRemove}
        >
          <Trash2 aria-hidden="true" className="size-4" />
        </Button>
      </div>

      {group.tags.length === 0 ? (
        <p className="text-xs text-muted">
          No tags yet. Add the answers a visitor can pick from.
        </p>
      ) : (
        <ul className="grid gap-2 sm:grid-cols-2">
          {group.tags.map((tag, index) => {
            const usage = usageByTag.get(tag.id) ?? 0;
            const tagName = tag.label || "this tag";

            return (
              <li key={tag.id} className="flex min-w-0 items-center gap-1.5">
                <SwatchButton
                  label={`Colour for ${tagName}`}
                  value={tag.color}
                  onChange={(color) => updateTag(index, { color })}
                />

                <TextField
                  fullWidth
                  autoFocus={tag.id === addedTagId}
                  aria-label={`Tag name in ${named}`}
                  value={tag.label}
                  onChange={(label) => updateTag(index, { label })}
                  className="min-w-0 flex-1"
                >
                  <Input placeholder="Tag name, e.g. Bikes" />
                </TextField>

                {/* Only when something wears it. A "0 locations" badge on every
                    tag the owner is still typing is noise, not information. */}
                {usage > 0 ? (
                  <span
                    className="shrink-0 whitespace-nowrap text-xs tabular-nums text-muted"
                    title={usage === 1 ? "1 location" : `${usage} locations`}
                  >
                    {usage}
                    <span className="max-sm:sr-only">
                      {usage === 1 ? " location" : " locations"}
                    </span>
                  </span>
                ) : null}

                <Button
                  size="sm"
                  variant="ghost"
                  isIconOnly
                  aria-label={`Remove ${tagName}`}
                  onPress={() =>
                    onChange({
                      ...group,
                      tags: group.tags.filter((_, position) => position !== index),
                    })
                  }
                >
                  <X aria-hidden="true" className="size-4" />
                </Button>
              </li>
            );
          })}
        </ul>
      )}

      <Button
        size="sm"
        variant="tertiary"
        isDisabled={group.tags.length >= MAX_TAGS_PER_GROUP}
        onPress={addTag}
      >
        <Plus aria-hidden="true" className="size-4" />
        Add tag
      </Button>
    </li>
  );
}
