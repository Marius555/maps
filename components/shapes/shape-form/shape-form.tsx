"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { Button, Label, Slider } from "@heroui/react";
import { Controller, useForm } from "react-hook-form";

import { SwatchPicker } from "@/components/ui/swatch-picker";
import { ErrorMessage } from "@/components/ui/error-message";
import { FormTextArea, FormTextField } from "@/components/ui/form-field";
import { shapeSummary } from "@/lib/map/shape-summary";
import { applyFieldErrors } from "@/lib/query/form-errors";
import { useUpdateShape } from "@/lib/query/shapes";
import type { Shape } from "@/lib/repositories/types";
import {
  MAX_STROKE_WIDTH,
  MIN_STROKE_WIDTH,
  shapeFormSchema,
  type ShapeFormValues,
} from "@/lib/validation/shape.schema";
import { strokeWidthOf } from "@/packages/shared/shapes";
import { StrokeStyleField } from "./stroke-style-field";

/**
 * Edits one shape.
 *
 * There is no geometry in here, and that is the point. A circle's radius is set
 * by dragging its handle and a polygon's outline by dragging its vertices, both
 * against the map they describe — typing "2400" into a metres field would be
 * asking someone to guess at a distance they can already see. This form owns the
 * things a map cannot show: what the area is called, what it means, and how it
 * should look.
 *
 * Fields bind through FormTextField, never `register()`. React Aria owns an
 * input's value, so a registered field renders blank and then saves the blank —
 * see components/ui/form-field.tsx.
 */
export function ShapeForm({
  mapId,
  shape,
  onSaved,
  onCancel,
}: {
  mapId: string;
  shape: Shape;
  onSaved?: () => void;
  onCancel?: () => void;
}) {
  const updateShape = useUpdateShape(mapId);

  const {
    handleSubmit,
    control,
    setError,
    formState: { isSubmitting },
  } = useForm<ShapeFormValues>({
    resolver: zodResolver(shapeFormSchema),
    defaultValues: {
      name: shape.name,
      description: shape.description ?? "",
      color: shape.color,
      opacity: shape.opacity,
      // Resolved, not the stored null: the slider has to open on the width the
      // shape is actually drawn at, or its first nudge would jump.
      strokeWidth: strokeWidthOf(
        shape.geometry.kind === "line",
        shape.strokeWidth,
      ),
      strokeStyle: shape.strokeStyle,
    },
  });

  const onSubmit = handleSubmit(async (values) => {
    try {
      await updateShape.mutateAsync({ shapeId: shape.id, input: values });
      onSaved?.();
    } catch (error) {
      applyFieldErrors(error, setError);
    }
  });

  return (
    <form onSubmit={onSubmit} className="space-y-4" noValidate>
      {updateShape.error ? <ErrorMessage error={updateShape.error} /> : null}

      <FormTextField control={control} name="name" label="Name" />

      {/* What the map already knows, stated once so the form is about a shape you
          can identify rather than about an anonymous set of fields. */}
      <p className="text-xs text-muted">{shapeSummary(shape.geometry)}</p>

      <FormTextArea control={control} name="description" label="Description" />

      <Controller
        control={control}
        name="color"
        render={({ field }) => (
          <div className="space-y-2">
            <Label>Colour</Label>
            <SwatchPicker
              label="Shape colour"
              value={field.value}
              onChange={field.onChange}
            />
          </div>
        )}
      />

      {/* Every kind, unlike Fill below. An area's edge is a stroke too, and a
          boundary traced over a coastline is a different thing at 1px than at 8. */}
      <Controller
        control={control}
        name="strokeWidth"
        render={({ field }) => (
          <Slider.Root
            minValue={MIN_STROKE_WIDTH}
            maxValue={MAX_STROKE_WIDTH}
            step={1}
            value={field.value}
            onChange={(value) =>
              field.onChange(Array.isArray(value) ? value[0] : value)
            }
          >
            <div className="flex items-center justify-between">
              <Label>Thickness</Label>
              {/* Not Slider.Output: the number means pixels, and a bare "8"
                  beside a "40%" one control down reads as a second percentage. */}
              <span className="text-xs tabular-nums text-muted">
                {field.value} px
              </span>
            </div>
            <Slider.Track>
              <Slider.Fill />
              <Slider.Thumb />
            </Slider.Track>
          </Slider.Root>
        )}
      />

      <Controller
        control={control}
        name="strokeStyle"
        render={({ field }) => (
          <StrokeStyleField value={field.value} onChange={field.onChange} />
        )}
      />

      {/* A line has no fill to set, and its stroke is drawn at full opacity on
          purpose — a shape at 5% still has to be findable, and its outline is
          what makes it so. Left out rather than disabled: a greyed slider
          invites you to work out why, and the answer is that it does not apply. */}
      {shape.geometry.kind === "line" ? null : (
        <Controller
          control={control}
          name="opacity"
          render={({ field }) => (
            <Slider.Root
              // Percentages, because nobody thinks in 0.2. The stored value stays
              // 0–1, which is what the fill layer and the snapshot want.
              minValue={0}
              maxValue={100}
              step={5}
              value={Math.round(field.value * 100)}
              onChange={(value) =>
                field.onChange((Array.isArray(value) ? value[0] : value) / 100)
              }
            >
              <div className="flex items-center justify-between">
                <Label>Fill</Label>
                <Slider.Output className="text-xs tabular-nums text-muted" />
              </div>
              <Slider.Track>
                <Slider.Fill />
                <Slider.Thumb />
              </Slider.Track>
            </Slider.Root>
          )}
        />
      )}

      <div className="flex justify-end gap-2">
        {onCancel ? (
          <Button variant="tertiary" onPress={onCancel}>
            Cancel
          </Button>
        ) : null}
        <Button type="submit" isPending={isSubmitting}>
          Save changes
        </Button>
      </div>
    </form>
  );
}
