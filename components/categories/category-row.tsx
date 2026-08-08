"use client";

import { Button, Input, TextField } from "@heroui/react";

import type { MapCategory } from "@/lib/repositories/types";
import { CategoryColorPicker } from "./category-color-picker";

export function CategoryRow({
  category,
  usageCount,
  onChange,
  onRemove,
}: {
  category: MapCategory;
  /** How many locations use it, so removal isn't a blind decision. */
  usageCount: number;
  onChange: (category: MapCategory) => void;
  onRemove: () => void;
}) {
  return (
    <li className="flex flex-col gap-3 rounded-xl border border-border p-3 sm:flex-row sm:items-center">
      <TextField
        fullWidth
        aria-label={`Name for ${category.label || "this category"}`}
        value={category.label}
        onChange={(label) => onChange({ ...category, label })}
        className="sm:flex-1"
      >
        <Input placeholder="Category name" />
      </TextField>

      <div className="flex items-center justify-between gap-3 sm:justify-end">
        <CategoryColorPicker
          label={`Colour for ${category.label || "this category"}`}
          value={category.color}
          onChange={(color) => onChange({ ...category, color })}
        />

        <div className="flex items-center gap-2">
          <span className="text-xs tabular-nums text-muted">
            {usageCount === 1 ? "1 location" : `${usageCount} locations`}
          </span>

          <Button
            size="sm"
            variant="tertiary"
            aria-label={`Remove ${category.label || "category"}`}
            onPress={onRemove}
          >
            Remove
          </Button>
        </div>
      </div>
    </li>
  );
}
