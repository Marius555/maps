import { z } from "zod";

import type {
  SnapshotFieldDisplay,
  SnapshotFieldType,
} from "@/packages/shared/snapshot";

import { idSchema } from "./common";

/**
 * Custom fields: what a location carries that we did not think of.
 *
 * The built-in set — address, phone, email, website, hours, photo — covers a
 * shop. It does not cover a booking link, a menu PDF, a dealer code, a "call
 * ahead for the workshop" note, or the twenty other things a real stockist list
 * has a column for. Without these the import step's honest answer to six extra
 * columns is to drop them.
 *
 * The two unions are checked against the snapshot's own (`satisfies`), because
 * the snapshot is the contract the embed reads and adding a type here without
 * teaching the embed to render it would ship a field nothing draws.
 *
 * The **definitions live on the map** and only the values live on a place. A
 * label is a promise about the whole set — the import maps a column onto one of
 * these, and the popup renders them in this order — and per-place labels would
 * let two rows spell one field differently with no way to tell which was meant.
 */

/**
 * Ten is already a popup nobody reads to the bottom of. It is also the ceiling
 * on what every visitor downloads: these values ship per place, so ten fields
 * across three thousand locations is real weight in the snapshot (CLAUDE.md §2).
 */
export const MAX_CUSTOM_FIELDS = 10;

/**
 * What the value *is*, which decides how the embed renders it: `text` is a line
 * of prose, the other three are links the visitor can act on. Not a validation
 * of the value — a half-typed phone number should still save.
 */
export const CUSTOM_FIELD_TYPES = [
  "text",
  "url",
  "tel",
  "email",
] as const satisfies readonly SnapshotFieldType[];
export type CustomFieldType = (typeof CUSTOM_FIELD_TYPES)[number];

/**
 * Where it lands on the card. `row` is a labelled line among the details;
 * `button` is the call to action — "Book a fitting", "View the menu" — which is
 * the whole reason a stockist wants a custom field in the first place.
 */
export const CUSTOM_FIELD_DISPLAYS = [
  "row",
  "button",
] as const satisfies readonly SnapshotFieldDisplay[];
export type CustomFieldDisplay = (typeof CUSTOM_FIELD_DISPLAYS)[number];

export const DEFAULT_CUSTOM_FIELD_TYPE: CustomFieldType = "text";
export const DEFAULT_CUSTOM_FIELD_DISPLAY: CustomFieldDisplay = "row";

/** Long enough for a booking URL with tracking on it, short enough to bound the snapshot. */
export const MAX_FIELD_VALUE_LENGTH = 512;

export const customFieldSchema = z.object({
  /** Stable across renames — a place's values are keyed by this, not the label. */
  id: idSchema,
  label: z
    .string()
    .trim()
    .min(1, "Give the field a name.")
    .max(48, "Keep the name under 48 characters."),
  type: z.enum(CUSTOM_FIELD_TYPES).default(DEFAULT_CUSTOM_FIELD_TYPE),
  showAs: z.enum(CUSTOM_FIELD_DISPLAYS).default(DEFAULT_CUSTOM_FIELD_DISPLAY),
});

export const customFieldsSchema = z
  .array(customFieldSchema)
  .max(MAX_CUSTOM_FIELDS, `You can have up to ${MAX_CUSTOM_FIELDS} extra fields.`)
  .refine(
    (fields) => new Set(fields.map((field) => field.id)).size === fields.length,
    "Two fields share an id.",
  )
  .refine(
    (fields) =>
      new Set(fields.map((field) => field.label.toLowerCase())).size === fields.length,
    "Two fields have the same name. Give each one a distinct name.",
  );

/**
 * One place's answers, keyed by field id.
 *
 * Keys are not checked against the map's definitions, for the reason
 * `placeTagsSchema` gives: deleting a field does not sweep its values off every
 * place, so a value keyed by a field that no longer exists is the normal state.
 * `buildSnapshot` narrows to defined fields, so nothing orphaned reaches a
 * visitor, and the value is still there if the owner puts the field back.
 */
export const placeFieldsSchema = z
  .record(
    z.string().trim().min(1).max(36),
    z.string().trim().max(MAX_FIELD_VALUE_LENGTH),
  )
  // An empty answer is the same as no answer, and storing it would ship an empty
  // string per place per unanswered field to every visitor.
  .transform((values) =>
    Object.fromEntries(Object.entries(values).filter(([, value]) => value !== "")),
  );

/** Fresh, never reused — the same rule and the same reason as `newTagId`. */
export function newCustomFieldId(): string {
  return `fld-${crypto.randomUUID().slice(0, 8)}`;
}

export type CustomFieldInput = z.infer<typeof customFieldSchema>;
export type PlaceFieldValues = z.infer<typeof placeFieldsSchema>;
