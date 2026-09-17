import type { ColumnMapping } from "@/lib/import/column-mapping";
import type { DraftPlace } from "@/lib/import/draft-places";
import { ADDRESS_PARTS } from "@/lib/import/fields";
import type { Place } from "@/lib/repositories/types";
import type { GeocodeStatus } from "@/lib/validation/place.schema";
import { normalizeKeyPart } from "./row-key";

/** What a sync may write onto an existing location. Nothing else, ever. */
export type SheetPlacePatch = {
  name?: string;
  address?: string;
  description?: string | null;
  phone?: string | null;
  email?: string | null;
  url?: string | null;
  tags?: string[];
  lat?: number;
  lng?: number;
  geocodeStatus?: GeocodeStatus;
  geocodeConfidence?: number | null;
  sourceKey?: string;
};

export type PatchablePlace = Pick<
  Place,
  "name" | "address" | "description" | "phone" | "email" | "url" | "tags" | "lat" | "lng"
> & { sourceKey?: string };

/**
 * Which of a location's fields the sheet is in charge of.
 *
 * Exactly the ones a column was mapped to, and that is the whole of "the sheet
 * wins, extras kept". A map imported without a phone column keeps every phone
 * number typed in the app; a map whose sheet has one gets the sheet's. Photos,
 * logo, hours, pin, group, custom fields and card overrides have no column at
 * all, so nothing a sync does can reach them.
 */
export function sheetOwnedFields(mapping: ColumnMapping) {
  return {
    address: ADDRESS_PARTS.some((part) => Boolean(mapping[part])),
    description: Boolean(mapping.description),
    phone: Boolean(mapping.phone),
    email: Boolean(mapping.email),
    url: Boolean(mapping.url),
    tags: Boolean(mapping.category || mapping.tags),
  };
}

/**
 * The change a row makes to the location it matched, and whether its new address
 * has to be looked up before that change is complete.
 *
 * **Coordinates follow the sheet only when the sheet has some.** Otherwise a
 * location's position changes only when its address text does. An unchanged
 * address keeps whatever position the location has — including a pin somebody
 * dragged by hand after the geocoder got it wrong, which a sync that re-geocoded
 * every row every night would quietly put back.
 *
 * An empty patch means the row and the location agree, so an idle sync writes
 * nothing at all.
 */
export function sheetPatch(
  place: PatchablePlace,
  row: { key: string; draft: DraftPlace },
  mapping: ColumnMapping,
  tagIds: readonly string[],
): { patch: SheetPlacePatch; needsGeocode: boolean } {
  const { draft } = row;
  const owned = sheetOwnedFields(mapping);
  const patch: SheetPlacePatch = {};
  let needsGeocode = false;

  if (place.sourceKey !== row.key) patch.sourceKey = row.key;
  if (place.name !== draft.name) patch.name = draft.name;

  for (const field of ["description", "phone", "email", "url"] as const) {
    if (!owned[field]) continue;

    const next = draft[field] || null;
    if ((place[field] || null) !== next) patch[field] = next;
  }

  if (owned.tags && !sameOrder(place.tags, tagIds)) patch.tags = [...tagIds];

  const addressChanged =
    owned.address &&
    normalizeKeyPart(place.address) !== normalizeKeyPart(draft.address);

  if (addressChanged) patch.address = draft.address;

  if (draft.lat !== null && draft.lng !== null) {
    if (!sameCoordinate(place.lat, draft.lat) || !sameCoordinate(place.lng, draft.lng)) {
      patch.lat = draft.lat;
      patch.lng = draft.lng;
      // Typed into the sheet is placed by a person, which is what "manual" means.
      patch.geocodeStatus = "manual";
      patch.geocodeConfidence = null;
    }
  } else if (addressChanged && draft.address) {
    needsGeocode = true;
  }

  return { patch, needsGeocode };
}

export function isEmptyPatch(patch: SheetPlacePatch): boolean {
  return Object.keys(patch).length === 0;
}

/** Order matters: the first tag colours the pin, so a reordering is a change. */
function sameOrder(a: readonly string[], b: readonly string[]): boolean {
  return a.length === b.length && a.every((value, index) => value === b[index]);
}

/**
 * Coordinates are stored rounded (`roundCoord`), and a float read back from
 * Appwrite is not bit-identical to the one written. A difference below a
 * centimetre is the same place.
 */
function sameCoordinate(a: number, b: number): boolean {
  return Math.abs(a - b) < 1e-7;
}
