import { DEFAULT_MAP_STYLE, isMapStyleKey } from "@/lib/map/style";
import { photoViewUrl, photoViewUrls } from "@/lib/storage/photo-url";
import { parseHours } from "@/packages/shared/hours";
import { readCardBlocks } from "@/lib/validation/card-overrides.schema";
import type { CustomPinIcon } from "@/packages/shared/pin-icons";
import {
  GEOCODE_STATUSES,
  type AddressParts,
  type GeocodeStatus,
} from "@/lib/validation/place.schema";
import { DEFAULT_GROUP_COLOR } from "@/lib/validation/group.schema";
import { PALETTE_COLORS } from "@/lib/validation/palette";
import { toShapeGeometry } from "./shape-geometry";
import {
  SHAPE_STROKE_STYLES,
  type ShapeStrokeStyle,
} from "@/packages/shared/shapes";
import {
  DEFAULT_SHAPE_COLOR,
  DEFAULT_SHAPE_OPACITY,
} from "@/lib/validation/shape.schema";
import {
  DEVICE_KINDS,
  type AppMap,
  type DeviceKind,
  type Group,
  type GroupRow,
  type MapCategory,
  type MapField,
  type MapSession,
  type MapSessionRow,
  type MapTagGroup,
  type MapRow,
  type Place,
  type PlaceRow,
  type SessionEvent,
  type Shape,
  type ShapeRow,
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

/**
 * A colour for every tag, including the ones written before tags had one.
 *
 * `tagSchema.color` is `.default(...)` precisely so a pre-merge row keeps
 * parsing — but a default only applies where something *parses*, and this column
 * is cast rather than parsed. Running the whole array through `tagGroupsSchema`
 * on read would fix the colour and introduce a much worse failure: its
 * refinements are about the set (unique labels, three ceilings), so one stored
 * label a character too long would drop a customer's entire vocabulary on load.
 * So only the field the merge added is filled in, and nothing can be lost.
 *
 * Cycled by position rather than all defaulted to one colour: a location's first
 * tag colours its pin, so a map whose tags all read back orange is a map with
 * nothing to tell its pins apart by. These are real values on the object from
 * here on, so the first save in Settings makes them permanent.
 */
function withTagColors(groups: MapTagGroup[]): MapTagGroup[] {
  let seen = 0;

  return groups.map((group) => ({
    ...group,
    tags: (group.tags ?? []).map((tag) => ({
      ...tag,
      color: tag.color || PALETTE_COLORS[seen++ % PALETTE_COLORS.length],
    })),
  }));
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
    tagGroups: withTagColors(parseJson<MapTagGroup[]>(row.tagGroups, [])),
    fields: parseJson<MapField[]>(row.fields, []),
    pinIcons: parseJson<CustomPinIcon[]>(row.pinIcons, []),
    settings: parseJson<Record<string, unknown>>(row.settings, {}),
    appearance: parseJson<Record<string, unknown>>(row.appearance, {}),
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
/**
 * A stored stroke style, or solid.
 *
 * Membership rather than a cast, for the reason at the top of this file: a row
 * hand-edited in the Appwrite console, or written by a newer version of the app,
 * must read as something rather than take the whole list down.
 */
function toStrokeStyle(value: string | null | undefined): ShapeStrokeStyle {
  return SHAPE_STROKE_STYLES.find((style) => style === value) ?? "solid";
}

export function toShape(row: ShapeRow): Shape {
  return {
    id: row.$id,
    mapId: row.mapId,
    name: row.name,
    description: row.description ?? null,
    color: row.color ?? DEFAULT_SHAPE_COLOR,
    opacity: row.opacity ?? DEFAULT_SHAPE_OPACITY,
    // 0 is the column's own "nobody has chosen one", which is every row written
    // before the column existed — not a zero-width outline.
    strokeWidth: row.strokeWidth && row.strokeWidth > 0 ? row.strokeWidth : null,
    strokeStyle: toStrokeStyle(row.strokeStyle),
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
  /*
   * One list, from two columns, with a rule rather than a merge.
   *
   * `photoIds` is the gallery and `photoId` is the single-photo column it
   * replaced. Every write sets the first and clears the second, so a row is only
   * ever using one of them and there is no order to reconcile — a row with a
   * gallery ignores the legacy column entirely, and a row written before
   * galleries existed keeps showing the photo it always showed.
   */
  const photoIds = row.photoIds?.length
    ? row.photoIds
    : row.photoId
      ? [row.photoId]
      : [];

  return {
    id: row.$id,
    mapId: row.mapId,
    name: row.name,
    lat: row.lat,
    lng: row.lng,
    address: row.address ?? "",
    // An array column, so no parsing — but still `?? []`, because a row written
    // before the column existed comes back with it absent rather than empty.
    tags: row.tags ?? [],
    fields: parseJson<Record<string, string>>(row.fields, {}),
    icon: row.icon ?? "",
    description: row.description ?? null,
    phone: row.phone ?? null,
    email: row.email ?? null,
    url: row.url ?? null,
    // parseHours holds the same never-throw contract as parseJson above, and adds
    // shape checking on top of it — a hand-edited row degrades to closed days.
    hours: parseHours(row.hours),
    photoIds,
    photoUrls: photoViewUrls(photoIds),
    photoUrl: photoViewUrl(photoIds[0]),
    logoId: row.logoId ?? null,
    // The same public view URL a photo gets, composed on the server so the
    // bucket id never reaches a client — see lib/storage/photo-url.ts.
    logoUrl: photoViewUrl(row.logoId),
    sortOrder: row.sortOrder ?? 0,
    geocodeConfidence: row.geocodeConfidence ?? null,
    geocodeStatus: toGeocodeStatus(row.geocodeStatus),
    // Same never-throw contract as the JSON above: a row written before this
    // column existed, or hand-edited in the console, reads as "no parts" rather
    // than taking the whole list down.
    addressParts: parseJson<AddressParts | null>(row.addressParts, null),
    groupId: row.groupId ?? "",
    /*
     * How this location's card differs from the account design, if at all.
     *
     * `{}` for every location nobody has singled out, which is nearly all of
     * them -- `mergeCardBlocks` hands the design straight back for that case.
     * Same never-throw contract as the JSON above, one step stricter: it drops a
     * single unreadable entry rather than the whole record, so one bad block
     * falls back to the design and the rest of the card keeps what it was given.
     */
    cardBlocks: readCardBlocks(parseJson<unknown>(row.cardBlocks, {})),
    createdAt: row.$createdAt,
    updatedAt: row.$updatedAt,
  };
}

/**
 * A stored visitor session → the shape the dashboard reads.
 *
 * Same never-throw contract as every mapper above, and it matters more here than
 * anywhere else: these rows are written by code running on somebody else's
 * website, so "an older embed wrote this" is the *normal* case rather than the
 * exceptional one. A session whose events will not parse comes back with none
 * rather than taking the Analytics page down.
 */
export function toMapSession(row: MapSessionRow): MapSession {
  return {
    id: row.$id,
    mapId: row.mapId,
    // `$createdAt` is the fallback rather than the primary: `startedAt` is the
    // visitor's own clock, which is what the offsets inside `events` are
    // measured from, so the two have to come from the same place.
    startedAt: row.startedAt || row.$createdAt,
    day: row.day || row.startedAt.slice(0, 10),
    country: row.country ?? null,
    city: row.city ?? null,
    lat: typeof row.lat === "number" ? row.lat : null,
    lng: typeof row.lng === "number" ? row.lng : null,
    ip: row.ip ?? null,
    host: row.host ?? "",
    path: row.path ?? "",
    referrer: row.referrer ?? "",
    device: toDeviceKind(row.device),
    events: toSessionEvents(row.events),
  };
}

function toDeviceKind(value: string | null | undefined): DeviceKind {
  return DEVICE_KINDS.includes(value as DeviceKind)
    ? (value as DeviceKind)
    : "desktop";
}

/**
 * The events array, with anything unrecognisable dropped rather than repaired.
 *
 * One malformed entry loses one interaction; the session keeps the rest. The
 * alternative — rejecting the row — would silently lose a whole visitor because
 * of one key, and the count on the dashboard would disagree with the row it is
 * counting.
 */
function toSessionEvents(value: string | null | undefined): SessionEvent[] {
  const raw = parseJson<unknown[]>(value, []);
  if (!Array.isArray(raw)) return [];

  const events: SessionEvent[] = [];

  for (const entry of raw) {
    if (!entry || typeof entry !== "object") continue;

    const { t, o, ...rest } = entry as Record<string, unknown>;
    if (typeof t !== "string" || !t) continue;

    const data: Record<string, string | number> = {};

    for (const [key, item] of Object.entries(rest)) {
      if (typeof item === "string") data[key] = item;
      else if (typeof item === "number" && Number.isFinite(item)) data[key] = item;
    }

    events.push({
      type: t,
      at: typeof o === "number" && Number.isFinite(o) ? o : 0,
      data,
    });
  }

  return events;
}
