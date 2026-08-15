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

import type { OpeningHours } from "./hours";

export type SnapshotCategory = {
  id: string;
  label: string;
  /** Hex, already resolved. The embed colours markers straight from this. */
  color: string;
};

/**
 * One of the map's own pins, flattened for the embed.
 *
 * No label: the legend is built from categories, and a pin's name exists only so
 * its owner can tell two of them apart in the dashboard. Sending it would be
 * bytes on every visitor's download for something nothing renders.
 *
 * `image` is the whole logo, inlined as a data URI. That is a deliberate cost —
 * a few KB per pin, once, rather than a request per visitor (§2) — and it is the
 * only form the embed can draw with no CSP surface: handed to `createImageBitmap`
 * through a Blob, it loads no URL at all.
 */
export type SnapshotPinIcon = {
  /** Matches the `custom:<id>` a place carries in `icon`. */
  id: string;
  /** Hex. Overrides the category colour — a custom pin is a finished design. */
  color: string;
  /** A built-in icon id from ./pin-icons.ts. Absent when this pin is an image. */
  glyph?: string;
  /** A `data:image/…;base64,…` URI. Absent when this pin is a glyph. */
  image?: string;
};

export type SnapshotPlace = {
  id: string;
  name: string;
  lat: number;
  lng: number;
  address?: string;
  /** Category id, matching SnapshotCategory.id. Absent when uncategorised. */
  category?: string;
  /**
   * Icon id: a built-in from ./pin-icons.ts, or `custom:<id>` matching a
   * SnapshotPinIcon below. Absent for a plain pin, which is what the embed draws
   * for an id it doesn't recognise too.
   *
   * Optional, and it has to stay that way for the same reason `hours` does:
   * snapshots are immutable, so every file published before this field existed
   * is still live on a customer's site and must keep parsing.
   */
  icon?: string;
  description?: string;
  phone?: string;
  email?: string;
  url?: string;
  /**
   * Seven entries, Monday first, `null` for a closed day — see ./hours.ts.
   *
   * Optional, and it has to stay that way: snapshots are immutable, so every file
   * published before this field existed is still live on a customer's site and
   * must keep parsing.
   */
  hours?: OpeningHours;
  /** Public storage URL, composed on the server so no bucket id ships. */
  photoUrl?: string;
};

/**
 * An area on the published map — a delivery radius, a service region, a boundary.
 *
 * A discriminated union rather than a flat row of optional numbers, so the embed
 * gets the same exhaustive `kind` switch the editor does and cannot read a
 * radius off a polygon. The geometry is turned into points by ./shapes.ts, which
 * both targets call — a circle drawn with a different number of segments in each
 * would be two visibly different circles in the editor's preview panel.
 *
 * The ring itself is not stored here. A 64-point circle is 64 coordinates the
 * embed can generate from three numbers, and shipping them would be about 1.5KB
 * per circle on every visitor's download to save a loop.
 */
export type SnapshotShape = {
  id: string;
  name: string;
  /** Hex, already resolved — the embed fills straight from this. */
  color: string;
  /** 0–1. The fill only; the outline is always drawn solid. */
  opacity: number;
  description?: string;
} & (
  | { kind: "circle"; lat: number; lng: number; radius: number }
  | { kind: "polygon"; points: [number, number][] }
);

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
  /**
   * The owner chose "Auto", so the visitor decides.
   *
   * When true the embed reads the visitor's own `prefers-color-scheme`, and if
   * it says dark it recolours `styleUrl` in the browser rather than fetching a
   * different one — there is no second URL, because the dark basemap *is* the
   * light one inverted (lib/map/darken-style.ts). Absent means the owner pinned
   * one basemap and every visitor gets it, so read `theme` instead.
   */
  autoDark?: boolean;
  /**
   * Whether the pinned basemap is dark enough that the embed's panels have to be
   * too. Meaningless — and omitted — when `autoDark` is set, because then the
   * answer is only known at view time.
   *
   * Optional, and absent means light. Snapshots are immutable and live customer
   * sites keep reading the one they were published with (§7), so a new *required*
   * field would break every map published before this shipped until its owner
   * happened to republish.
   */
  theme?: "light" | "dark";
  /** OSM and tile-provider credit. Non-negotiable on every render (§12). */
  attribution: string;
  center: SnapshotCenter;
  /** Extent of the places, or null when the map has none. */
  bounds: SnapshotBounds | null;
  categories: SnapshotCategory[];
  /**
   * The map's own pins, and only the ones a published place actually wears.
   *
   * Optional, and it has to stay that way for the same reason `hours` and `theme`
   * are: snapshots are immutable, so every file published before this field
   * existed is still live on a customer's site and must keep parsing.
   */
  pinIcons?: SnapshotPinIcon[];
  places: SnapshotPlace[];
  /**
   * Areas drawn on the map, under the pins.
   *
   * Optional, and it has to stay that way for the same reason `hours`, `theme`
   * and `pinIcons` are: snapshots are immutable, so every file published before
   * this field existed is still live on a customer's site and must keep parsing.
   * The version stays `1` — the embed's fetch rejects anything else outright.
   */
  shapes?: SnapshotShape[];
  settings: SnapshotSettings;
  /**
   * Hostnames allowed to embed this map. Empty means "anywhere".
   * Anti-abuse, not security — anyone can copy the snapshot URL (§7).
   */
  allowedDomains: string[];
};
