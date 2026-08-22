import type { Place } from "@/lib/repositories/types";
import type { CreatePlaceInput, GeocodeStatus } from "@/lib/validation/place.schema";
import type { DraftPlace } from "./draft-places";

/**
 * A draft, shaped like a Place so the review step can reuse the editor's map
 * canvas instead of growing a second marker layer that drifts from the first.
 *
 * Only for rendering. The id is the draft key, which is not a database id — these
 * rows do not exist yet.
 */
export function draftToPlace(draft: DraftPlace, mapId: string): Place {
  const now = new Date().toISOString();

  return {
    id: draft.key,
    mapId,
    name: draft.name || `Row ${draft.rowNumber}`,
    // Callers filter unplaced drafts out before rendering; 0,0 would be the
    // Atlantic, so this is a fallback that should never be shown.
    lat: draft.lat ?? 0,
    lng: draft.lng ?? 0,
    address: draft.address,
    category: "",
    // A CSV has no tags or custom fields yet — resolveTags stamps them onto the
    // create input, not onto this preview row.
    tags: [],
    fields: {},
    // A CSV has no icon column. Imported locations land as plain pins.
    icon: "",
    description: draft.description || null,
    phone: draft.phone || null,
    email: draft.email || null,
    url: draft.url || null,
    // A CSV column for opening hours would need a format to parse; imports set
    // them afterwards, per location.
    hours: null,
    photoId: null,
    photoUrl: null,
    sortOrder: draft.rowNumber,
    geocodeConfidence: draft.confidence,
    addressParts: null,
    geocodeStatus: toGeocodeStatus(draft.status),
    // A CSV has no group column, and the review step has no sidebar to show one
    // in. Imported locations land loose and are grouped afterwards, if at all.
    groupId: "",
    createdAt: now,
    updatedAt: now,
  };
}

/**
 * The payload that actually gets saved.
 *
 * `categoryId` and `tagIds` are resolved by the caller from the draft's labels —
 * places store ids, and a CSV only ever has text (see resolve-categories.ts and
 * resolve-tags.ts).
 */
export function draftToCreateInput(
  draft: DraftPlace,
  categoryId: string,
  tagIds: string[] = [],
): CreatePlaceInput {
  return {
    name: draft.name,
    // Non-null by construction: only importable drafts reach here.
    lat: draft.lat as number,
    lng: draft.lng as number,
    address: draft.address,
    category: categoryId,
    tags: tagIds,
    // No custom fields from an import yet — the mapping step has no way to point
    // a column at one. Everything else here is already wired for when it does.
    fields: {},
    icon: "",
    description: draft.description || undefined,
    phone: draft.phone || undefined,
    email: draft.email || undefined,
    url: draft.url || undefined,
    sortOrder: 0,
    geocodeStatus: toGeocodeStatus(draft.status),
    // The review step already showed this; saving it is what lets a row still say
    // "check this" a week later, rather than only on the screen that geocoded it.
    geocodeConfidence: draft.confidence,
  };
}

/** "pending" never reaches the database — an unresolved row is a failed one. */
function toGeocodeStatus(status: DraftPlace["status"]): GeocodeStatus {
  return status === "pending" ? "failed" : status;
}
