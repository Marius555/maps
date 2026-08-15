import { z } from "zod";

import {
  MIN_CIRCLE_RADIUS_M,
  MIN_POLYGON_POINTS,
} from "@/packages/shared/shapes";
import { hexColorSchema, latSchema, lngSchema } from "./common";
import { groupIdSchema } from "./group.schema";

/**
 * What a shape is allowed to be, on the way in.
 *
 * One schema serves the form, the POST and the PATCH, per CLAUDE.md §9 — the
 * client never validates alone.
 */

export const SHAPE_KINDS = ["circle", "polygon"] as const;

export const DEFAULT_SHAPE_COLOR = "#1c7ed6";
export const DEFAULT_SHAPE_OPACITY = 0.2;

/**
 * A polygon is capped, and the cap is about the snapshot rather than the
 * database. Every point is roughly 24 bytes of JSON that every visitor to the
 * customer's site downloads; 500 is far past any boundary someone will trace by
 * hand and still only ~12KB.
 */
export const MAX_POLYGON_POINTS = 500;

/**
 * [lng, lat] — GeoJSON's order.
 *
 * A tuple rather than an object, because this is the one field that repeats
 * hundreds of times in a snapshot and `[25.28,54.687]` is half the bytes of
 * `{"lng":25.28,"lat":54.687}`.
 */
const pointSchema = z.tuple([lngSchema, latSchema]);

const circleGeometrySchema = z.object({
  kind: z.literal("circle"),
  lng: lngSchema,
  lat: latSchema,
  radius: z
    .number()
    .min(
      MIN_CIRCLE_RADIUS_M,
      `A circle has to be at least ${MIN_CIRCLE_RADIUS_M} metres across its radius.`,
    )
    // Half the equator. Past this a "circle" wraps the globe and stops being one.
    .max(20_000_000, "That circle is larger than the planet."),
});

const polygonGeometrySchema = z.object({
  kind: z.literal("polygon"),
  points: z
    .array(pointSchema)
    .min(MIN_POLYGON_POINTS, "A shape needs at least three points to enclose an area.")
    .max(
      MAX_POLYGON_POINTS,
      `A shape can have up to ${MAX_POLYGON_POINTS} points. Trace it with fewer.`,
    ),
});

export const shapeGeometrySchema = z.discriminatedUnion("kind", [
  circleGeometrySchema,
  polygonGeometrySchema,
]);

const nameSchema = z
  .string()
  .trim()
  .min(1, "Give the shape a name.")
  .max(128, "Keep the name under 128 characters.");

const opacitySchema = z
  .number()
  .min(0, "Opacity runs from 0 to 1.")
  .max(1, "Opacity runs from 0 to 1.");

export const createShapeSchema = z.object({
  name: nameSchema,
  geometry: shapeGeometrySchema,
  description: z.string().max(5000).optional(),
  color: hexColorSchema.default(DEFAULT_SHAPE_COLOR),
  opacity: opacitySchema.default(DEFAULT_SHAPE_OPACITY),
  sortOrder: z.number().int().min(0).default(0),
  // Optional, not defaulted — see createPlaceSchema: nothing is drawn into a
  // group, it joins one afterwards.
  groupId: groupIdSchema.optional(),
});

export const updateShapeSchema = z
  .object({
    name: nameSchema,
    geometry: shapeGeometrySchema,
    description: z.string().max(5000),
    color: hexColorSchema,
    opacity: opacitySchema,
    sortOrder: z.number().int().min(0),
    groupId: groupIdSchema,
  })
  .partial()
  .refine((value) => Object.keys(value).length > 0, "Nothing to save.");

/**
 * What the edit form holds.
 *
 * Separate from `updateShapeSchema` for the reason spelled out in
 * place.schema.ts: `.partial()` would make every field possibly-undefined and
 * put a non-null assertion on every input. Geometry is absent because it is
 * edited by dragging handles on the map, never by typing.
 */
export const shapeFormSchema = z.object({
  name: nameSchema,
  description: z.string().max(5000),
  color: hexColorSchema,
  opacity: opacitySchema,
});

export type ShapeFormValues = z.infer<typeof shapeFormSchema>;
export type CreateShapeInput = z.output<typeof createShapeSchema>;
export type UpdateShapeInput = z.output<typeof updateShapeSchema>;
