"use client";

import { Button, Input, TextField } from "@heroui/react";
import { Plus, X } from "lucide-react";

import type { MapTagGroup } from "@/lib/repositories/types";
import { MAX_TAGS_PER_GROUP, newTagId } from "@/lib/validation/tag.schema";

/**
 * One filter group: a question, and the answers a location can give.
 *
 * The nesting is the point and is why this is not shaped like a category row.
 * The embed reads groups as AND and the tags inside one as OR, so a visitor sees
 * "Sells: bikes or skis" narrowed by "Open: Sundays" — and the owner has to be
 * able to see which tags share a question while they are writing them.
 */
export function TagGroupRow({
  group,
  usageByTag,
  onChange,
  onRemove,
}: {
  group: MapTagGroup;
  /** How many locations wear each tag, so removing one isn't a blind decision. */
  usageByTag: Map<string, number>;
  onChange: (group: MapTagGroup) => void;
  onRemove: () => void;
}) {
  const named = group.label || "this group";

  const addTag = () => {
    onChange({
      ...group,
      // Fresh id, never a reused one — see newTagId. Nothing sweeps a deleted tag
      // off the places wearing it, so a repeated id would resurrect it onto
      // locations nobody assigned it to.
      tags: [...group.tags, { id: newTagId(), label: "" }],
    });
  };

  return (
    <li className="space-y-3 rounded-xl border border-border p-3">
      <div className="flex items-center gap-3">
        <TextField
          fullWidth
          aria-label={`Name for ${named}`}
          value={group.label}
          onChange={(label) => onChange({ ...group, label })}
          className="flex-1"
        >
          <Input placeholder="What are you filtering by? e.g. Sells" />
        </TextField>

        <Button
          size="sm"
          variant="tertiary"
          aria-label={`Remove ${named}`}
          onPress={onRemove}
        >
          Remove
        </Button>
      </div>

      {group.tags.length === 0 ? (
        <p className="text-xs text-muted">
          No tags yet. Add the answers a visitor can pick from.
        </p>
      ) : (
        <ul className="flex flex-wrap gap-2">
          {group.tags.map((tag, index) => {
            const usage = usageByTag.get(tag.id) ?? 0;

            return (
              <li
                key={tag.id}
                className="flex items-center gap-1 rounded-lg border border-border py-1 pl-2 pr-1"
              >
                <TextField
                  aria-label={`Tag name in ${named}`}
                  value={tag.label}
                  onChange={(label) =>
                    onChange({
                      ...group,
                      tags: group.tags.map((existing, position) =>
                        position === index ? { ...existing, label } : existing,
                      ),
                    })
                  }
                  className="w-36"
                >
                  <Input placeholder="Tag name" />
                </TextField>

                {/* Only when something wears it. A "0 locations" badge on every
                    tag the owner is still typing is noise, not information. */}
                {usage > 0 ? (
                  <span className="text-xs tabular-nums text-muted">{usage}</span>
                ) : null}

                <Button
                  size="sm"
                  variant="tertiary"
                  isIconOnly
                  aria-label={`Remove ${tag.label || "tag"}`}
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
        variant="secondary"
        isDisabled={group.tags.length >= MAX_TAGS_PER_GROUP}
        onPress={addTag}
      >
        <Plus aria-hidden="true" className="size-4" />
        Add tag
      </Button>
    </li>
  );
}
