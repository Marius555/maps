import { z } from "zod";

import {
  MIN_CIRCLE_RADIUS_M,
  MIN_LINE_POINTS,
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

export const SHAPE_KINDS = ["circle", "polygon", "line"] as const;

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

/**
 * A bonded endpoint's location id, or absent.
 *
 * Shaped like `groupIdSchema` and for the same reason: it is a reference the
 * client may hand back untouched, and a reference to something deleted is read as
 * "not bonded" rather than repaired. Never trusted as coordinates — the renderer
 * resolves it against the live location or falls back to the stored point.
 */
const bondSchema = z
  .string()
  .max(36, "That is not a location id.")
  .regex(/^[a-zA-Z0-9_-]*$/, "That is not a location id.");

const lineGeometrySchema = z.object({
  kind: z.literal("line"),
  points: z
    .array(pointSchema)
    .min(MIN_LINE_POINTS, "A line needs at least two points.")
    // Shares the polygon's cap, and for the identical reason: every point is
    // roughly 24 bytes on every visitor's download.
    .max(
      MAX_POLYGON_POINTS,
      `A line can have up to ${MAX_POLYGON_POINTS} points. Draw it with fewer.`,
    ),
  from: bondSchema.optional(),
  to: bondSchema.optional(),
});

export const shapeGeometrySchema = z.discriminatedUnion("kind", [
  circleGeometrySchema,
  polygonGeometrySchema,
  lineGeometrySchema,
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

/**
 * Import confirm payload, mirroring `bulkCreatePlacesSchema`.
 *
 * Capped lower than places because a shape is far heavier: 200 boundaries at 500
 * points each is a payload measured in megabytes, where 200 locations is a few
 * dozen kilobytes. Fifty keeps a chunk comfortably inside any body-size limit,
 * and the plan limit is still checked against the map's real total on every one.
 */
export const MAX_BULK_SHAPES = 50;

export const bulkCreateShapesSchema = z.object({
  shapes: z
    .array(createShapeSchema)
    .min(1, "Nothing to import.")
    .max(MAX_BULK_SHAPES, `Send at most ${MAX_BULK_SHAPES} shapes at a time.`),
});

export type ShapeFormValues = z.infer<typeof shapeFormSchema>;
export type CreateShapeInput = z.output<typeof createShapeSchema>;
export type UpdateShapeInput = z.output<typeof updateShapeSchema>;
export type BulkCreateShapesInput = z.output<typeof bulkCreateShapesSchema>;
