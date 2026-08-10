import { DEFAULT_MAP_STYLE, isMapStyleKey } from "@/lib/map/style";
import { photoViewUrl } from "@/lib/storage/photo-url";
import { parseHours } from "@/packages/shared/hours";
import {
  GEOCODE_STATUSES,
  type AddressParts,
  type GeocodeStatus,
} from "@/lib/validation/place.schema";
import type { AppMap, MapCategory, MapRow, Place, PlaceRow } from "./types";

/**
 * Row → domain. These never throw: a row written by an older version of the app,
 * or hand-edited in the Appwrite console, must not take down the whole list.
 */

function parseJson<T>(value: string | null | undefined, fallback: T): T {
  if (!value) return fallback;
  try {
    const parsed: unknown = JSON.parse(value);
    return parsed === null ? fallback : (parsed as T);
  } catch {
    return fallback;
  }
}

function toGeocodeStatus(value: string | null | undefined): GeocodeStatus {
  return (GEOCODE_STATUSES as readonly string[]).includes(value ?? "")
    ? (value as GeocodeStatus)
    : "manual";
}

export function toAppMap(row: MapRow): AppMap {
  return {
    id: row.$id,
    userId: row.userId,
    name: row.name,
    slug: row.slug,
    style: isMapStyleKey(row.style) ? row.style : DEFAULT_MAP_STYLE,
    defaultLat: row.defaultLat,
    defaultLng: row.defaultLng,
    defaultZoom: row.defaultZoom,
    categories: parseJson<MapCategory[]>(row.categories, []),
    settings: parseJson<Record<string, unknown>>(row.settings, {}),
    allowedDomains: row.allowedDomains ?? [],
    publishedAt: row.publishedAt ?? null,
    snapshotUrl: row.snapshotUrl ?? null,
    createdAt: row.$createdAt,
    updatedAt: row.$updatedAt,
  };
}

export function toPlace(row: PlaceRow): Place {
  return {
    id: row.$id,
    mapId: row.mapId,
    name: row.name,
    lat: row.lat,
    lng: row.lng,
    address: row.address ?? "",
    category: row.category ?? "",
    description: row.description ?? null,
    phone: row.phone ?? null,
    email: row.email ?? null,
    url: row.url ?? null,
    // parseHours holds the same never-throw contract as parseJson above, and adds
    // shape checking on top of it — a hand-edited row degrades to closed days.
    hours: parseHours(row.hours),
    photoId: row.photoId ?? null,
    photoUrl: photoViewUrl(row.photoId),
    sortOrder: row.sortOrder ?? 0,
    geocodeConfidence: row.geocodeConfidence ?? null,
    geocodeStatus: toGeocodeStatus(row.geocodeStatus),
    // Same never-throw contract as the JSON above: a row written before this
    // column existed, or hand-edited in the console, reads as "no parts" rather
    // than taking the whole list down.
    addressParts: parseJson<AddressParts | null>(row.addressParts, null),
    createdAt: row.$createdAt,
    updatedAt: row.$updatedAt,
  };
}
