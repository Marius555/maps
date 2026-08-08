/**
 * The published snapshot format — the only contract between the dashboard and
 * the embed.
 *
 * Type-only by rule (CLAUDE.md §4): no runtime value may cross this boundary, or
 * the embed would start pulling dashboard code in behind it. That includes the
 * version number, which is expressed as the literal type `1` and written by the
 * generator rather than exported as a const.
 *
 * Everything a visitor's browser needs is in here. The embed fetches this file
 * and static tiles, and makes no other request — that is CLAUDE.md §2, and it is
 * the reason this type carries resolved values (styleUrl, photoUrl, attribution)
 * instead of ids the embed would have to look up.
 *
 * Optional fields are omitted rather than written as null. On a 3,000-place map
 * the empty strings add up, and the embed treats absent and empty the same way.
 */

export type SnapshotCategory = {
  id: string;
  label: string;
  /** Hex, already resolved. The embed colours markers straight from this. */
  color: string;
};

export type SnapshotPlace = {
  id: string;
  name: string;
  lat: number;
  lng: number;
  address?: string;
  /** Category id, matching SnapshotCategory.id. Absent when uncategorised. */
  category?: string;
  description?: string;
  phone?: string;
  email?: string;
  url?: string;
  /** Public storage URL, composed on the server so no bucket id ships. */
  photoUrl?: string;
};

/** Which of the embed's optional controls are switched on. */
export type SnapshotSettings = {
  clustering: boolean;
  search: boolean;
  filters: boolean;
  nearest: boolean;
};

export type SnapshotBounds = {
  west: number;
  south: number;
  east: number;
  north: number;
};

export type SnapshotCenter = {
  lat: number;
  lng: number;
  zoom: number;
};

export type MapSnapshot = {
  version: 1;
  /** ISO timestamp. Also the filename, which is what makes snapshots immutable. */
  generatedAt: string;
  mapId: string;
  name: string;
  slug: string;
  /**
   * Fully resolved basemap URL, not a style key. Moving from OpenFreeMap to our
   * own PMTiles on R2 (CLAUDE.md §7) then becomes a republish, not a redeploy of
   * every customer's embed.
   */
  styleUrl: string;
  /** OSM and tile-provider credit. Non-negotiable on every render (§12). */
  attribution: string;
  center: SnapshotCenter;
  /** Extent of the places, or null when the map has none. */
  bounds: SnapshotBounds | null;
  categories: SnapshotCategory[];
  places: SnapshotPlace[];
  settings: SnapshotSettings;
  /**
   * Hostnames allowed to embed this map. Empty means "anywhere".
   * Anti-abuse, not security — anyone can copy the snapshot URL (§7).
   */
  allowedDomains: string[];
};
