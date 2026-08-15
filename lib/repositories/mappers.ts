import { DEFAULT_MAP_STYLE, isMapStyleKey } from "@/lib/map/style";
import { photoViewUrl } from "@/lib/storage/photo-url";
import { parseHours } from "@/packages/shared/hours";
import type { CustomPinIcon } from "@/packages/shared/pin-icons";
import type {
  CircleGeometry,
  LngLatTuple,
  ShapeGeometry,
} from "@/packages/shared/shapes";
import {
  GEOCODE_STATUSES,
  type AddressParts,
  type GeocodeStatus,
} from "@/lib/validation/place.schema";
import { DEFAULT_GROUP_COLOR } from "@/lib/validation/group.schema";
import {
  DEFAULT_SHAPE_COLOR,
  DEFAULT_SHAPE_OPACITY,
} from "@/lib/validation/shape.schema";
import type {
  AppMap,
  Group,
  GroupRow,
  MapCategory,
  MapRow,
  Place,
  PlaceRow,
  Shape,
  ShapeRow,
} from "./types";

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
    pinIcons: parseJson<CustomPinIcon[]>(row.pinIcons, []),
    settings: parseJson<Record<string, unknown>>(row.settings, {}),
    allowedDomains: row.allowedDomains ?? [],
    publishedAt: row.publishedAt ?? null,
    snapshotUrl: row.snapshotUrl ?? null,
    createdAt: row.$createdAt,
    updatedAt: row.$updatedAt,
  };
}

/**
 * Row → geometry, from the `kind` column plus the payload.
 *
 * The column is the discriminator and the JSON holds only the numbers, so the two
 * cannot drift. Unreadable JSON degrades to a shape with no size rather than
 * throwing — the same contract as everything else here. That shape draws as
 * nothing and can still be selected and deleted, which is a better answer than a
 * map that refuses to load.
 */
function toShapeGeometry(row: ShapeRow): ShapeGeometry {
  if (row.kind === "polygon") {
    const parsed = parseJson<{ points?: LngLatTuple[] }>(row.geometry, {});
    return { kind: "polygon", points: parsed.points ?? [] };
  }

  const parsed = parseJson<Partial<CircleGeometry>>(row.geometry, {});

  return {
    kind: "circle",
    lng: parsed.lng ?? 0,
    lat: parsed.lat ?? 0,
    radius: parsed.radius ?? 0,
  };
}

export function toShape(row: ShapeRow): Shape {
  return {
    id: row.$id,
    mapId: row.mapId,
    name: row.name,
    description: row.description ?? null,
    color: row.color ?? DEFAULT_SHAPE_COLOR,
    opacity: row.opacity ?? DEFAULT_SHAPE_OPACITY,
    geometry: toShapeGeometry(row),
    sortOrder: row.sortOrder ?? 0,
    groupId: row.groupId ?? "",
    createdAt: row.$createdAt,
    updatedAt: row.$updatedAt,
  };
}

export function toGroup(row: GroupRow): Group {
  return {
    id: row.$id,
    mapId: row.mapId,
    name: row.name,
    color: row.color ?? DEFAULT_GROUP_COLOR,
    sortOrder: row.sortOrder ?? 0,
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
    icon: row.icon ?? "",
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
    groupId: row.groupId ?? "",
    createdAt: row.$createdAt,
    updatedAt: row.$updatedAt,
  };
}
