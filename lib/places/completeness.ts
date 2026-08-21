import type { Place } from "@/lib/repositories/types";

/**
 * The optional details a location can be missing.
 *
 * In `lib` rather than beside the icons that draw them, because two things need
 * the same answer: the row that marks the gaps and the filter that finds every
 * row with one. A predicate written twice is two definitions of "incomplete", and
 * the filter would quietly stop agreeing with the indicator it was meant to
 * explain.
 *
 * Deliberately not including name, address or coordinates. Those aren't optional
 * — a location without them is broken rather than unfinished, and that is what
 * `geocodeStatus` and `PlaceStatusFlag` are for.
 */

export const OPTIONAL_FIELDS = [
  "phone",
  "email",
  "url",
  "photo",
  "hours",
  "description",
] as const;

export type OptionalField = (typeof OPTIONAL_FIELDS)[number];

/** Lower case: these appear mid-sentence, in "No phone, website or photo". */
export const OPTIONAL_FIELD_LABELS: Record<OptionalField, string> = {
  phone: "phone",
  email: "email",
  url: "website",
  photo: "photo",
  hours: "opening hours",
  description: "description",
};

const HAS: Record<OptionalField, (place: Place) => boolean> = {
  phone: (place) => Boolean(place.phone),
  email: (place) => Boolean(place.email),
  url: (place) => Boolean(place.url),
  // Either half is enough: `photoUrl` is resolved on the server from `photoId`,
  // so a row that has one and not the other is mid-flight, not empty.
  photo: (place) => Boolean(place.photoId || place.photoUrl),
  hours: (place) => Boolean(place.hours),
  description: (place) => Boolean(place.description),
};

export function missingFields(place: Place): OptionalField[] {
  return OPTIONAL_FIELDS.filter((field) => !HAS[field](place));
}

export function isIncomplete(place: Place): boolean {
  return OPTIONAL_FIELDS.some((field) => !HAS[field](place));
}

/** "No phone, website or photo" — one sentence for a whole row's gaps. */
export function describeMissing(fields: OptionalField[]): string {
  if (fields.length === 0) return "";

  const labels = fields.map((field) => OPTIONAL_FIELD_LABELS[field]);
  if (labels.length === 1) return `No ${labels[0]}`;

  return `No ${labels.slice(0, -1).join(", ")} or ${labels[labels.length - 1]}`;
}
