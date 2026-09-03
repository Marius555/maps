import type { Models } from "node-appwrite";

import type { MapStyleKey } from "@/lib/map/style";
import type { OpeningHours } from "@/packages/shared/hours";
import type { CustomPinIcon } from "@/packages/shared/pin-icons";
import type { ShapeGeometry, ShapeStrokeStyle } from "@/packages/shared/shapes";
import type { AddressParts, GeocodeStatus } from "@/lib/validation/place.schema";
import type { CustomFieldInput } from "@/lib/validation/field.schema";
import type { TagGroupInput } from "@/lib/validation/tag.schema";

/**
 * Raw Appwrite row shapes. These stay inside /lib/repositories.
 *
 * Optional columns are declared optional, not just nullable: the SDK derives the
 * `data` argument of createRow from this type, so a required-but-empty field
 * would force every insert to spell out columns it has nothing to say about.
 */
export type MapRow = Models.Row & {
  userId: string;
  name: string;
  slug: string;
  style: string;
  defaultLat: number;
  defaultLng: number;
  defaultZoom: number;
  categories?: string | null;
  tagGroups?: string | null;
  fields?: string | null;
  pinIcons?: string | null;
  settings?: string | null;
  appearance?: string | null;
  allowedDomains?: string[] | null;
  publishedAt?: string | null;
  snapshotUrl?: string | null;
};

export type PlaceRow = Models.Row & {
  mapId: string;
  name: string;
  lat: number;
  lng: number;
  address?: string | null;
  category?: string | null;
  /** A real Appwrite array column, so it arrives as an array, not as JSON. */
  tags?: string[] | null;
  fields?: string | null;
  icon?: string | null;
  description?: string | null;
  phone?: string | null;
  email?: string | null;
  url?: string | null;
  hours?: string | null;
  /** An array column, so it arrives as an array. Cover first. */
  photoIds?: string[] | null;
  /** The single-photo column `photoIds` replaced. Read-only; never written. */
  photoId?: string | null;
  sortOrder?: number | null;
  geocodeConfidence?: number | null;
  geocodeStatus?: string | null;
  addressParts?: string | null;
  groupId?: string | null;
};

export type ShapeRow = Models.Row & {
  mapId: string;
  name: string;
  kind: string;
  description?: string | null;
  color?: string | null;
  opacity?: number | null;
  /** 0 for every row written before the column existed. See `strokeWidthOf`. */
  strokeWidth?: number | null;
  strokeStyle?: string | null;
  geometry: string;
  sortOrder?: number | null;
  groupId?: string | null;
};

export type GroupRow = Models.Row & {
  mapId: string;
  name: string;
  color?: string | null;
  sortOrder?: number | null;
};

/** Domain shapes. Everything outside /lib/repositories sees only these. */
export type MapCategory = {
  id: string;
  label: string;
  color: string;
};

/**
 * The map's filter vocabulary and its extra fields.
 *
 * Aliased from the zod schemas rather than redeclared: these travel from a form
 * straight into a JSON column, so a second hand-written definition here would be
 * one more place for the two to drift apart. `MapCategory` predates that habit.
 */
export type MapTagGroup = TagGroupInput;
export type MapField = CustomFieldInput;

export type AppMap = {
  id: string;
  userId: string;
  name: string;
  slug: string;
  style: MapStyleKey;
  defaultLat: number;
  defaultLng: number;
  defaultZoom: number;
  categories: MapCategory[];
  /** Groups of tags a location can wear — see lib/validation/tag.schema.ts. */
  tagGroups: MapTagGroup[];
  /** Extra fields these locations carry — see lib/validation/field.schema.ts. */
  fields: MapField[];
  /**
   * The pins the customer built — see packages/shared/pin-icons.ts. Shared with
   * the embed, so the type lives there rather than here.
   */
  pinIcons: CustomPinIcon[];
  settings: Record<string, unknown>;
  appearance: Record<string, unknown>;
  allowedDomains: string[];
  publishedAt: string | null;
  snapshotUrl: string | null;
  createdAt: string;
  updatedAt: string;
};

export type Place = {
  id: string;
  mapId: string;
  name: string;
  lat: number;
  lng: number;
  address: string;
  /**
   * Tag ids from the map's own groups, **in the order this location was given
   * them**. The first is what colours its pin, which is what makes the order
   * load-bearing rather than incidental — nothing may sort this.
   *
   * May name a tag the map no longer defines: deleting a tag does not sweep it
   * off the places wearing it, and the snapshot narrows to defined tags at
   * publish time.
   */
  tags: string[];
  /** Answers to the map's extra fields, keyed by field id. Same dangling rule. */
  fields: Record<string, string>;
  /**
   * Which icon the pin wears, or "" for a plain one. A built-in id from
   * packages/shared/pin-icons.ts, or `custom:<id>` naming one of the map's own
   * pins — resolved at render time, never validated against either list on the
   * way in, so an id this version doesn't recognise draws a plain pin rather than
   * blocking the save.
   */
  icon: string;
  description: string | null;
  phone: string | null;
  email: string | null;
  url: string | null;
  /** Null when no day has been filled in — see packages/shared/hours.ts. */
  hours: OpeningHours | null;
  /**
   * This location's photos, cover first.
   *
   * Composed by the mapper from `photoIds`, falling back to the legacy
   * `photoId` for rows written before galleries existed — so nothing outside the
   * repository has to know there were ever two columns.
   */
  photoIds: string[];
  /**
   * The same, resolved to public URLs on the server. Clients render these
   * directly rather than composing a storage URL, which keeps the bucket id
   * server-side.
   */
  photoUrls: string[];
  /**
   * The cover, which is `photoUrls[0]`. Kept as its own field because most
   * things that show a location show one picture — a list row, a marker card,
   * the published snapshot's own `photoUrl` — and every one of them would
   * otherwise index into an array to say so.
   */
  photoUrl: string | null;
  sortOrder: number;
  geocodeConfidence: number | null;
  geocodeStatus: GeocodeStatus;
  /**
   * The geocoder's answer in parts, or null when no geocoder ever spoke for this
   * row. The postcode under the street in the locations list comes from here.
   */
  addressParts: AddressParts | null;
  /** The group this belongs to, or "" — see the `Group` type below. */
  groupId: string;
  createdAt: string;
  updatedAt: string;
};

/**
 * An area on the map, beside the pins.
 *
 * The geometry is the discriminated union from packages/shared/shapes.ts, so the
 * editor and the embed both switch on one shape of data — and so the code that
 * turns a circle into points has exactly one copy.
 */
export type Shape = {
  id: string;
  mapId: string;
  name: string;
  description: string | null;
  /** Hex. A shape's own, not a category's — see the schema for why. */
  color: string;
  /** 0–1. The fill only; the outline is always drawn at full opacity. */
  opacity: number;
  /**
   * The outline's width in pixels, or null for the default for this kind.
   *
   * Null rather than a number, because the default is 4px for a line and 2px for
   * an area's edge and this type does not know which it is. `strokeWidthOf` in
   * packages/shared/shapes.ts is what resolves it, and both renderers call it.
   */
  strokeWidth: number | null;
  /** Solid, dashed or dotted. Never null — an unreadable row reads as solid. */
  strokeStyle: ShapeStrokeStyle;
  geometry: ShapeGeometry;
  sortOrder: number;
  /** The group this belongs to, or "" — see the `Group` type below. */
  groupId: string;
  createdAt: string;
  updatedAt: string;
};

/**
 * A bundle of locations and shapes the owner treats as one thing.
 *
 * Membership is stored on the members, not here: a `Group` is a name and a
 * colour, and a place or shape names it in its own `groupId`. That is what makes
 * grouping one location a single-column PATCH.
 *
 * A `groupId` naming a group that no longer exists reads as ungrouped. Deleting
 * a group deletes one row and leaves its members' ids dangling on purpose — see
 * groups.repository.ts.
 *
 * Editor-only. Nothing about a group reaches a published snapshot.
 */
export type Group = {
  id: string;
  mapId: string;
  name: string;
  /** Hex. Tints the group's row and its members' selection ring in the editor. */
  color: string;
  sortOrder: number;
  createdAt: string;
  updatedAt: string;
};

export type Page<T> = {
  items: T[];
  nextCursor: string | null;
  total: number;
};
