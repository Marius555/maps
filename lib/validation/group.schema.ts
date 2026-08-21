import { z } from "zod";

import { hexColorSchema, pinIconRefSchema } from "./common";

/**
 * What a group is allowed to be, on the way in.
 *
 * One schema serves the form, the POST and the PATCH, per CLAUDE.md §9.
 *
 * A group is deliberately thin — a name, a colour, an order. Membership is not
 * here because it is not stored here: a place or a shape names its group in its
 * own `groupId`, which is what keeps grouping one location a one-column PATCH
 * rather than a rewrite of a list. See lib/repositories/types.ts.
 */

export const DEFAULT_GROUP_COLOR = "#495057";

/**
 * The id a member carries, or "" for ungrouped.
 *
 * Empty is a real value, not a missing one: clearing a group is a PATCH that has
 * to say so, and `undefined` in a partial schema means "leave this alone".
 */
export const groupIdSchema = z
  .string()
  .max(36, "That is not a group id.")
  .regex(/^[a-zA-Z0-9_-]*$/, "That is not a group id.");

const nameSchema = z
  .string()
  .trim()
  .min(1, "Give the group a name.")
  .max(128, "Keep the name under 128 characters.");

export const createGroupSchema = z.object({
  name: nameSchema,
  color: hexColorSchema.default(DEFAULT_GROUP_COLOR),
  sortOrder: z.number().int().min(0).default(0),
});

export const updateGroupSchema = z
  .object({
    name: nameSchema,
    color: hexColorSchema,
    sortOrder: z.number().int().min(0),
  })
  .partial()
  .refine((value) => Object.keys(value).length > 0, "Nothing to save.");

/**
 * The pin every location in a group is about to be given.
 *
 * A write against the *members*, not against the group — a group holds a name, a
 * colour and an order, and nothing about it reaches a published snapshot
 * (lib/repositories/types.ts). A remembered `group.pinIcon` would have to break
 * that, so the group is only ever the way the user names a set of locations, and
 * what gets stored is each location's own `icon`. A location added afterwards
 * therefore keeps its own pin, which is the trade this shape makes.
 */
export const setGroupPinSchema = z.object({ icon: pinIconRefSchema });

/**
 * What the edit form holds — see shape.schema.ts for why this is not just
 * `updateGroupSchema`: `.partial()` would make every field possibly-undefined
 * and put a non-null assertion on every input.
 */
export const groupFormSchema = z.object({
  name: nameSchema,
  color: hexColorSchema,
});

export type GroupFormValues = z.infer<typeof groupFormSchema>;
export type CreateGroupInput = z.output<typeof createGroupSchema>;
export type UpdateGroupInput = z.output<typeof updateGroupSchema>;
export type SetGroupPinInput = z.output<typeof setGroupPinSchema>;
